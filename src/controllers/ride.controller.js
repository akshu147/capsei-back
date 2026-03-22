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
        { type: 'bike', base: 30, perKm: 8, perMin: 1 },
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
      // const timeFare = durationMin * vehicle.perMin
      const platformFee = 3

      const total = baseFare + distanceFare + platformFee

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
      pickup: {
        placeId: pick_placeId,
        lat: pickup.lat,
        lng: pickup.lng
      },

      dropoff: {
        placeId: drop_PlaceId,
        lat: dropoff.lat,
        lng: dropoff.lng
      },
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
    const userId = req.user.id // 🔥 auth middleware se
    console.log('User ID:', userId)
    console.log('Booking request:', req.body)

    const {
      pickupPlaceId,
      dropoffPlaceId,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      serviceType,
      vehicleType,
      scheduleType,
      scheduledTime,
      fare,
      durationMin,
      distanceKm
    } = req.body

    // 1️⃣ Find nearest available driver for this vehicle type
    const driverQuery = `
  SELECT 
    id, 
    full_name, 
    ST_X(location::geometry) AS lng, 
    ST_Y(location::geometry) AS lat,
    ST_Distance(
      location,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    ) AS distance
  FROM drivers
  WHERE is_online = TRUE
    AND is_available = TRUE
    AND vehicle_type = $3
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      5000  -- 🔥 5 KM radius
    )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
  LIMIT 1;
`

    const driverResult = await pool.query(driverQuery, [
      pickupLng,
      pickupLat,
      vehicleType
    ])
    const nearestDriver = driverResult.rows[0]
    console.log(nearestDriver, 'gandmara')

    if (!nearestDriver) {
      return res.status(404).json({
        success: false,
        message: 'No available driver nearby'
      })
    }
    // 2️⃣ Insert booking into database
    const query = `
      INSERT INTO bookings (
        user_id,
        pickup_place_id,
        pickup_location,
        dropoff_place_id,
        dropoff_location,
        service_type,
        vehicle_type,
        schedule_type,
        scheduled_time,
        distance_km,
        duration_min,
        base_fare,
        distance_fare,
        platform_fee,
        total_fare,
        driver_id
      )
      VALUES (
        $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
        $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
        $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18
      )
      RETURNING *;
    `

    const values = [
      userId, // $1
      pickupPlaceId, // $2
      pickupLng, // $3
      pickupLat, // $4
      dropoffPlaceId, // $5
      dropoffLng, // $6
      dropoffLat, // $7
      serviceType, // $8
      vehicleType, // $9
      scheduleType, // $10
      scheduleType === 'later' ? scheduledTime : null, // $11
      distanceKm, // $12
      durationMin, // $13
      fare.baseFare, // $14
      fare.distanceFare, // $15
      fare.platformFee, // $16
      fare.total, // $17
      nearestDriver.id // $18
    ]

    const result = await pool.query(query, values)

    // 3️⃣ Mark driver as busy
    await pool.query(`UPDATE drivers SET is_available = FALSE WHERE id = $1`, [
      nearestDriver.id
    ])

    // ✅ Respond back with booking + driver info
    return res.status(201).json({
      success: true,
      message: 'Ride booked successfully',
      booking: result.rows[0],
      driver: nearestDriver
    })
    console.log(nearestDriver, 'bhsiya')
  } catch (err) {
    console.error('Book Ride Error:', err.message)
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}
export { bookRideController, calculateprice }
