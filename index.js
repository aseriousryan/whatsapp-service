const qrcode = require("qrcode-terminal")
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const multer = require("multer")

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

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`)
})

app.post("/submit", upload.single("img"), (req, res) => {
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
