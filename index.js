const qrcode = require("qrcode-terminal")
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const multer = require("multer")
const { createClient } = require("@supabase/supabase-js")
const jwt = require("jsonwebtoken")
const supabaseUrl = "https://njsnrwfrlgplnlrbvvxd.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qc25yd2ZybGdwbG5scmJ2dnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDUzMTEzNzcsImV4cCI6MjAyMDg4NzM3N30.mz1I5rGz7-kmuGKD98RVyvmBEdCrWFEVnUgjVdMzFt8"
const supabase = createClient(supabaseUrl, supabaseKey)

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ["--no-sandbox"] },
})

const upload = multer()
const express = require("express")
const app = express()
const port = 3000
app.use(express.json())

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true })
})

client.on("ready", () => {
  console.log("Client is ready!")
})

client.initialize()

// Middleware for JWT token verification
const authenticate = (req, res, next) => {
  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ error: "Unauthorized - Token missing" })
  }

  jwt.verify(token, "Dqg8vBIGkJ", (err, user) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" })
    }
    req.user = user
    next()
  })
}

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`)
})

app.post("/login", async (req, res) => {
  const { clientId, password } = req.body

  // Fetch user from Supabase
  const { data: users, error } = await supabase
    .from("users")
    .select("clientId, password")
    .eq("clientId", clientId)
    .single()

  // Log the Supabase query response
  console.log("Supabase Query Response:", { users, error })

  if (error || !users) {
    return res.status(401).json({ error: "Invalid credentials" })
  }

  // Check the password without hashing for testing
  const isPasswordValid = password === users.password

  // Log the password comparison result
  console.log("Password Comparison Result:", isPasswordValid)

  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid credentials" })
  }

  // Generate JWT token
  const token = jwt.sign(
    { clientId: users.clientId, role: "user" },
    "Dqg8vBIGkJ",
    { expiresIn: "1h" }
  )

  // Log the generated token
  console.log("Generated Token:", token)

  res.json({ token })
})

app.post("/submit", authenticate, upload.single("img"), (req, res) => {
  let promises = []

  const { category, msg, contact_num } = req.body
  const file = req.file
  const media = new MessageMedia(
    file.mimetype,
    file.buffer.toString("base64"),
    file.originalname
  )
  if (category.toUpperCase() == "E-INVOICE") {
    if (msg == "" || file == null) {
      return res
        .status(500)
        .json({ status: "error", message: "Missing required parameters" })
    } else {
      promises.push(client.sendMessage(contact_num, media, { caption: msg }))
    }
  } else if (category.toUpperCase() == "OTP") {
    promises.push(client.sendMessage(contact_num, message))
  } else if (category.toUpperCase() == "REWARDING") {
    if (msg == "" || file == null) {
      return res
        .status(500)
        .json({ status: "error", message: "Missing required parameters" })
    } else {
      promises.push(client.sendMessage(contact_num, media, { caption: msg }))
    }
  }

  Promise.all(promises)
    .then((response) => {
      res.status(200).send({ success: true, responses: response })
    })
    .catch((error) => {
      res.status(500).send({ success: false, error: error })
    })
})
