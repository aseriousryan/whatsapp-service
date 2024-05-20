const qrcode = require("qrcode-terminal")
const express = require("express")
const app = express()
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const multer = require("multer")
const { createClient } = require("@supabase/supabase-js")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")

const swaggerJSDoc = require("swagger-jsdoc")
const swaggerUi = require("swagger-ui-express")
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Whatsapp Service",
      version: "1.1.0",
    },
    servers: [
      {
        url: "http://srv465260.hstgr.cloud:3000/",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
        },
      },
    },
  },
  apis: ["./index.js"],
}

function getErrorDetails(error) {
  if (typeof error === "string") {
    return { message: error }
  }
  return {
    message: error.message,
    stack: error.stack,
    ...error,
  }
}

const swaggerSpec = swaggerJSDoc(options)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
const supabaseUrl = "http://195.35.7.235:8000"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzA1NTkzNjAwLAogICJleHAiOiAxODYzNDQ2NDAwCn0.IOdYznc_Hy78vBQtJOAqObVhhCQOWF2t70K8Gkd3si4"
const supabase = createClient(supabaseUrl, supabaseKey)

const client = new Client({
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
})

const upload = multer()

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
  try {
    qrcode.generate(qr, { small: true })
  } catch (error) {
    console.error("QR Code Generation Error:", error)
  }
})

client.on("ready", () => {
  console.log("Client is ready!")
})

try {
  client.initialize()
} catch (error) {
  console.error("WhatsApp Client Initialization Error:", error)
}

const authenticate = (req, res, next) => {
  const token = req.headers.authorization

  if (!token) {
    return res.status(452).json({ error: "Unauthorized - Token missing" })
  }

  jwt.verify(token, "Dqg8vBIGkJ", (err, user) => {
    if (err) {
      return res.status(452).json({ error: "Unauthorized - Invalid token" })
    }
    req.user = user
    next()
  })
}

app.listen(port, () => {
  console.log(
    `API is running at http://srv465260.hstgr.cloud:${port}, wait until client is ready message is shown before sending requests.`
  )
})

/**
 * @swagger
 * /register:
 *   post:
 *     summary: This API is used to register a user.
 *     description: This API is used to register a user.
 *     requestBody:
 *       description: User registration data.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The client ID for registration.
 *               password:
 *                 type: string
 *                 description: The password for registration.
 *               confirmPassword:
 *                 type: string
 *                 description: The confirmed password for registration.
 *     responses:
 *       200:
 *         description: User registered successfully.
 *       454:
 *         description: Bad request.
 *       456:
 *         description: Internal server error.
 */
app.post("/register", async (req, res) => {
  const { clientId, password, confirmPassword } = req.body

  if (!clientId || clientId == null) {
    return res.status(454).json({ error: "clientId is required" })
  }

  if (
    !password ||
    password == null ||
    !confirmPassword ||
    confirmPassword == null
  ) {
    return res
      .status(454)
      .json({ error: "password and confirmPassword is required" })
  }

  if (password !== confirmPassword) {
    return res.status(454).json({ error: "Passwords do not match" })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const { data: existingUser, error: userError } = await supabase
      .from("users")
      .select("clientId")
      .eq("clientId", clientId)
      .single()

    if (existingUser) {
      return res.status(454).json({ error: "User already exists" })
    }

    // Insert a new user with hashed password
    const { error: insertError } = await supabase
      .from("users")
      .upsert([{ clientId, password: hashedPassword }], {
        onConflict: ["clientId"],
      })

    if (insertError) {
      console.error("Insert Error:", insertError)
      return res.status(456).json({ error: "Failed to register user" })
    }

    // Fetch the registered user data
    const { data: newUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("clientId", clientId)
      .single()

    if (selectError || !newUser) {
      console.error("Supabase Select Error:", selectError)
      return res.status(456).json({ error: "Failed to fetch registered user" })
    }

    res.status(200).json({
      success: true,
      message: "User registered successfully",
      user: newUser,
    })
  } catch (error) {
    console.error("Registration Error:", error)
    res.status(456).json({ error: "Internal server error" })
  }
})

/**
 * @swagger
 * /login:
 *   post:
 *     summary: This API is used to log a user in.
 *     description: This API is used to log a user in.
 *     requestBody:
 *       description: User login data.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The client ID for login.
 *               password:
 *                 type: string
 *                 description: The password for login.
 *     responses:
 *       200:
 *         description: User logged in successfully.
 *       454:
 *         description: Bad request.
 *       452:
 *         description: Unauthorized.
 *       456:
 *         description: Internal server error.
 */
app.post("/login", async (req, res) => {
  const { clientId, password } = req.body

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("clientId, password")
      .eq("clientId", clientId)
      .single()

    if (error || !users) {
      return res.status(452).json({ error: "Invalid credentials" })
    }

    const isPasswordValid = await bcrypt.compare(password, users.password)

    if (!isPasswordValid) {
      return res.status(452).json({ error: "Invalid credentials" })
    }

    try {
      const token = jwt.sign(
        { clientId: users.clientId, role: "user" },
        "Dqg8vBIGkJ",
        { expiresIn: "1h" }
      )

      res.json({ token, clientId: users.clientId })
    } catch (error) {
      console.error("JWT Token Generation Error:", error)
      res.status(456).json({ error: "Error generating JWT token" })
    }
  } catch (error) {
    console.error("Login Error:", error)
    res.status(456).json({ error: "Internal server error" })
  }
})

/**
 * @swagger
 * /submit:
 *   post:
 *     security:
 *     - BearerAuth: []
 *     summary: Submit image and message to a contact
 *     description: Submit image and message to a contact
 *     requestBody:
 *       description: Data to be submitted, including an image.
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               contact_num:
 *                 type: string
 *                 description: The contact number for the message to be sent to.
 *               clientId:
 *                 type: string
 *                 description: The client ID.
 *               img:
 *                 type: string
 *                 format: binary
 *                 description: The image/document file to be uploaded.
 *               msg:
 *                 type: string
 *                 description: An optional message.
 *     responses:
 *       200:
 *         description: Data submitted successfully.
 *       454:
 *         description: Bad request.
 *       452:
 *         description: Unauthorized.
 *       456:
 *         description: Internal server error.
 */

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
      return res.status(454).json({
        status: "error",
        message: `Missing required parameters: ${missingParameters.join(", ")}`,
      })
    }

    if (req.user.clientId !== clientId) {
      return res.status(452).json({ error: "Unauthorized - Invalid clientId" })
    }

    // Fetch user data to check balance
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("usage, total_message")
      .eq("clientId", clientId)
      .single()

    if (userError || !user) {
      return res.status(452).json({ error: "User not found" })
    }

    const usage = user.usage || 0
    const balance = user.total_message - usage
    if (balance <= 0) {
      return res.status(452).json({ error: "Insufficient balance" })
    }

    const media = new MessageMedia(
      file.mimetype,
      file.buffer.toString("base64"),
      file.originalname
    )

    const timestamp = new Date().getTime()
    const uniqueFileName = `${timestamp}_${file.originalname}`

    try {
      const { data: fileData, error: storageError } = await supabase.storage
        .from("files")
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
        })

      if (storageError) {
        console.error("Storage Error:", storageError.message)
        throw new Error(storageError.message)
      }
    } catch (error) {
      console.error("File Upload Error:", error)
      return res.status(456).json({ error: "Error uploading file to Storage" })
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

    let data
    try {
      const { data: upsertData, error } = await supabase
        .from("data")
        .upsert([dataToStore])

      if (error) {
        console.error("Upsert Error:", error.message)
        throw new Error(error.message)
      }
      data = upsertData
    } catch (error) {
      console.error("Database Upsert Error:", error)
      return res.status(456).json({ error: "Error upserting data to database" })
    }

    const caption = req.body.msg || null

    const promises = [
      client.sendMessage(updated_contact_num, media, { caption }),
    ]

    Promise.all(promises)
      .then(async (response) => {
        // Increment usage count
        const { error: updateError } = await supabase
          .from("users")
          .update({ usage: usage + 1 })
          .eq("clientId", clientId)

        if (updateError) {
          console.error("Usage Update Error:", updateError.message)
          return res.status(456).json({ error: "Error updating usage count" })
        }

        res.status(200).send({
          success: true,
          remainingBalance: balance - 1,
          responses: response,
          storedData: data,
          // Remaining balance after this request
        })
      })
      .catch((error) => {
        console.error("Promise Error: ", error)
        if (error.message.includes("Cannot read properties of undefined")) {
          res.status(456).json({
            success: false,
            error: {
              message: "Client not initialized",
              stack: error.stack || "No stack trace",
            },
          })
        } else {
          res.status(456).json({
            success: false,
            error: {
              message: error.message || "Unknown error",
              stack: error.stack || "No stack trace",
            },
          })
        }
      })
  } catch (error) {
    console.error("Catch Error: ", error)
    res.status(456).json({
      success: false,
      error: {
        message: error.message || "Unknown error",
        stack: error.stack || "No stack trace",
      },
    })
  }
})

/**
 * @swagger
 * /topup:
 *   post:
 *     summary: This API is used to top up the total_message count for a user.
 *     description: This API is used to top up the total_message count for a user.
 *     requestBody:
 *       description: User top-up data.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The client ID to top up.
 *               amount:
 *                 type: integer
 *                 description: The amount to top up.
 *     responses:
 *       200:
 *         description: Top-up successful.
 *       454:
 *         description: Bad request.
 *       456:
 *         description: Internal server error.
 */
app.post("/topup", async (req, res) => {
  const { clientId, amount } = req.body

  if (!clientId || !amount || typeof amount !== "number" || amount <= 0) {
    return res.status(454).json({ error: "Invalid clientId or amount" })
  }

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("total_message, usage")
      .eq("clientId", clientId)
      .single()

    if (userError || !user) {
      return res.status(452).json({ error: "User not found" })
    }

    const total_message = user.total_message || 0
    const usage = user.usage || 0
    const balance_before = total_message - usage
    const newTotalMessage = total_message + amount
    const balance_after = newTotalMessage - usage

    const { error: updateError } = await supabase
      .from("users")
      .update({ total_message: newTotalMessage })
      .eq("clientId", clientId)

    if (updateError) {
      console.error("Top-Up Update Error:", updateError.message)
      return res.status(456).json({ error: "Error updating total_message" })
    }

    res.status(200).json({
      success: true,
      message: "Top-up successful",
      previous_balance: balance_before,
      new_balance: balance_after,
    })
  } catch (error) {
    console.error("Top-Up Error:", error)
    res.status(456).json({ error: "Internal server error" })
  }
})
/**
 * @swagger
 * /balance:
 *   post:
 *     summary: Check the total messages, usage, and balance for a user.
 *     description: This API is used to check the total messages, usage, and balance for a user.
 *     requestBody:
 *       description: User balance data.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The client ID to check balance.
 *     responses:
 *       200:
 *         description: Balance retrieved successfully.
 *       454:
 *         description: Bad request.
 *       456:
 *         description: Internal server error.
 */
app.post("/balance", async (req, res) => {
  const { clientId } = req.body

  if (!clientId) {
    return res.status(454).json({ error: "clientId is required" })
  }

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("total_message, usage")
      .eq("clientId", clientId)
      .single()

    if (userError || !user) {
      return res.status(452).json({ error: "User not found" })
    }

    const total_message = user.total_message || 0
    const usage = user.usage || 0
    const balance = total_message - usage

    res.status(200).json({
      clientId,
      total_message,
      usage,
      balance,
    })
  } catch (error) {
    console.error("Balance Check Error:", error)
    res.status(456).json({ error: "Internal server error" })
  }
})
