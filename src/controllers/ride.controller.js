import { pool } from '../config/db.js'

import axios from 'axios'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

// 🔹 Get lat/lng from Place ID
const getLatLngFromPlaceId = async placeId => {
  const response = await axios.get(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'location'
      }
    }
  )
  // console.log(response, "lawdad")
  return {
    lat: response.data.location.latitude,
    lng: response.data.location.longitude
  }
}

// 🔹 Main Price Calculation
const calculateprice = async (req, res) => {
  try {
    const { pick_placeId, drop_PlaceId, serviceType } = req.body
    if (!pick_placeId || !drop_PlaceId || !serviceType) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    // 1️⃣ Get Coordinates
    const pickup = await getLatLngFromPlaceId(pick_placeId)
    const dropoff = await getLatLngFromPlaceId(drop_PlaceId)

    // 2️⃣ Call Route Matrix API
    const matrixResponse = await axios.post(
      'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
      {
        origins: [
          {
            waypoint: {
              location: {
                latLng: {
                  latitude: pickup.lat,
                  longitude: pickup.lng
                }
              }
            }
          }
        ],
        destinations: [
          {
            waypoint: {
              location: {
                latLng: {
                  latitude: dropoff.lat,
                  longitude: dropoff.lng
                }
              }
            }
          }
        ],
        travelMode: 'DRIVE'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask':
            'originIndex,destinationIndex,distanceMeters,duration'
        }
      }
    )

    const routeData = matrixResponse.data[0]

    const distanceKm = routeData.distanceMeters / 1000
    const durationMin = parseInt(routeData.duration.replace('s', '')) / 60

    // 3️⃣ Pricing
    // 3️⃣ Vehicle Mapping
    const categoryVehicles = {
      bike: [
        { type: 'standard_bike', base: 30, perKm: 8, perMin: 1 },
        { type: 'premium_bike', base: 50, perKm: 10, perMin: 1.5 }
      ],
      car: [
        { type: 'citycar', base: 50, perKm: 12, perMin: 2 },
        { type: 'sedan', base: 70, perKm: 15, perMin: 2.5 },
        { type: 'suv', base: 100, perKm: 20, perMin: 3 },
        { type: 'premium', base: 150, perKm: 25, perMin: 4 }
      ]
    }

    const vehicles = categoryVehicles[serviceType]

    if (!vehicles) {
      return res.status(400).json({ message: 'Invalid category' })
    }

    // 4️⃣ Calculate fare for each vehicle
    const fareList = vehicles.map(vehicle => {
      const baseFare = vehicle.base
      const distanceFare = distanceKm * vehicle.perKm
      const timeFare = durationMin * vehicle.perMin
      const platformFee = 3

      const total = baseFare + distanceFare + timeFare + platformFee

      return {
        vehicleType: vehicle.type,
        baseFare: Number(baseFare.toFixed(0)),
        distanceFare: Number(distanceFare.toFixed(0)),
        platformFee: platformFee,
        total: Number(total.toFixed(0))
      }
    })

    // 5️⃣ Final Response
    return res.status(200).json({
      distance_km: Number(distanceKm.toFixed(2)),
      duration_min: Number(durationMin.toFixed(0)),
      vehicles: fareList
    })
  } catch (err) {
    console.log('ERROR STATUS:', err.response?.status)
    console.log('ERROR DATA:', err.response?.data)
    console.log('FULL ERROR:', err.message)

    return res.status(500).json({ message: 'Server error' })
  }
}

const bookRideController = async (req, res) => {
  try {
    const userId = req.user?.id
    const { pickup, dropoff, serviceType, vehicleType, fare, scheduledAt } =
      req.body

    // 1️⃣ Auth check
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      })
    }

    // 2️⃣ Validation
    if (!pickup || !dropoff || !serviceType || !vehicleType || !fare) {
      return res.status(400).json({
        success: false,
        message: 'All required fields are mandatory'
      })
    }

    // 3️⃣ Insert ride
    const result = await pool.query(
      `INSERT INTO rides 
      (user_id, pickup, dropoff, service_type, vehicle_type, fare, scheduled_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        userId,
        pickup,
        dropoff,
        serviceType,
        vehicleType,
        fare,
        scheduledAt || null
      ]
    )

    // 4️⃣ Success
    return res.status(201).json({
      success: true,
      message: 'Ride booked successfully',
      data: result.rows[0]
    })
  } catch (err) {
    console.error('Book Ride Error:', err)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

export { bookRideController, calculateprice }
