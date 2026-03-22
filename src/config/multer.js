import multer from 'multer'
import path from 'path'
import fs from 'fs'

// ✅ absolute path lo (best practice)
const uploadPath = path.join(process.cwd(), 'uploads')

// ✅ folder auto-create agar exist nahi hai
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath) // ✅ yaha fixed path use karo
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9)

    console.log(uniqueName + " file name")

    cb(
      null,
      uniqueName + path.extname(file.originalname)
    )
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/

  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  )

  const mimetype = allowedTypes.test(file.mimetype)

  if (extname && mimetype) {
    cb(null, true)
  } else {
    cb(new Error('Only images & PDFs allowed!')) // ✅ proper error
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }
})

export { upload }