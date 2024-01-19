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

function validateAndFormatPhoneNumber(phoneNumber) {
  const startsWith6 = phoneNumber.startsWith("6")

  const endsWithCus = phoneNumber.endsWith("@c.us")

  if (!startsWith6) {
    phoneNumber = "6" + phoneNumber
  }

  if (!endsWithCus) {
    phoneNumber += "@c.us"
  }

  return phoneNumber
}

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true })
})

client.on("ready", () => {
  console.log("Client is ready!")
})

client.initialize()

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

app.post("/register", async (req, res) => {
  const { clientId, password, confirmPassword } = req.body
  if (!clientId || clientId == null) {
    return res.status(400).json({ error: "clientId is required" })
  }
  if (
    !password ||
    password == null ||
    !confirmPassword ||
    confirmPassword == null
  ) {
    return res
      .status(400)
      .json({ error: "password and confirmPassword is required" })
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" })
  }

  try {
    const { data: existingUser, error: userError } = await supabase
      .from("users")
      .select("clientId")
      .eq("clientId", clientId)
      .single()

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" })
    }

    const { error: insertError } = await supabase
      .from("users")
      .upsert([{ clientId, password }], {
        onConflict: ["clientId"],
      })

    if (insertError) {
      console.error("Supabase Insert Error:", insertError)
      return res.status(500).json({ error: "Failed to register user" })
    }

    const { data: newUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("clientId", clientId)
      .single()

    if (selectError || !newUser) {
      console.error("Supabase Select Error:", selectError)
      return res.status(500).json({ error: "Failed to fetch registered user" })
    }

    console.log("New User Registered:", newUser)

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: newUser,
    })
  } catch (error) {
    console.error("Registration Error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/login", async (req, res) => {
  const { clientId, password } = req.body

  const { data: users, error } = await supabase
    .from("users")
    .select("clientId, password")
    .eq("clientId", clientId)
    .single()

  console.log("Supabase Query Response:", { users, error })

  if (error || !users) {
    return res.status(401).json({ error: "Invalid credentials" })
  }

  const isPasswordValid = password === users.password

  console.log("Password Comparison Result:", isPasswordValid)

  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid credentials" })
  }

  const token = jwt.sign(
    { clientId: users.clientId, role: "user" },
    "Dqg8vBIGkJ",
    { expiresIn: "1h" }
  )

  console.log("Generated Token:", token)

  res.json({ token, clientId: users.clientId })
})

app.post("/submit", authenticate, upload.single("img"), async (req, res) => {
  try {
    const { contact_num, clientId } = req.body
    const file = req.file

    const missingParameters = []

    if (!file) {
      missingParameters.push("img")
    }
    if (!contact_num) {
      missingParameters.push("contact_num")
    }
    if (!clientId) {
      missingParameters.push("clientId")
    }

    if (missingParameters.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Missing required parameters: ${missingParameters.join(", ")}`,
      })
    }

    if (req.user.clientId !== clientId) {
      return res.status(401).json({ error: "Unauthorized - Invalid clientId" })
    }

    const media = new MessageMedia(
      file.mimetype,
      file.buffer.toString("base64"),
      file.originalname
    )

    const timestamp = new Date().getTime()
    const uniqueFileName = `${timestamp}_${file.originalname}`

    const { data: fileData, error: storageError } = await supabase.storage
      .from("files")
      .upload(uniqueFileName, file.buffer, {
        contentType: file.mimetype,
      })

    if (storageError) {
      throw new Error(storageError.message)
    }

    const updated_contact_num = validateAndFormatPhoneNumber(contact_num)

    const dataToStore = {
      category: "E-INVOICE",
      contact_num,
      clientId,
      img: uniqueFileName,
    }

    if (req.body.msg) {
      dataToStore.msg = req.body.msg
    }

    const { data, error } = await supabase.from("data").upsert([dataToStore])

    if (error) {
      throw new Error(error.message)
    }

    const caption = req.body.msg || null

    const promises = [
      client.sendMessage(updated_contact_num, media, { caption }),
    ]

    Promise.all(promises)
      .then((response) => {
        res.status(200).send({
          success: true,
          responses: response,
          storedData: data,
        })
      })
      .catch((error) => {
        res.status(500).send({ success: false, error: error })
      })
  } catch (error) {
    res.status(500).send({ success: false, error: error.message })
  }
})
