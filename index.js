const express = require('express')
const dotenv = require('dotenv')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { GoogleGenerativeAI } = require('@google/generative-ai')

dotenv.config()
const app = express()
app.use(express.json())

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({
    model: 'models/gemini-1.5-flash'
})

const upload = multer({
    dest: 'uploads/'
})

function imageToGenerativePart(imagePath, originalName) {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeType(originalName); // Use original file name for extension

    return {
        inlineData: {
            mimeType: mimeType,
            data: base64Image
        }
    };
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.webp':
            return 'image/webp';
        default:
            throw new Error(`Unsupported image format: ${ext}`);
    }
}


app.post('/generate-text', async (req, res) => {
    const { promp } = req.body

    try {
        const result = await model.generateContent(promp)
        const response = await result.response
        res.json({
            output: response.text()
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.post('/generate-from-image', upload.single('image'), async (req, res) => {
    const prompt = req.body.prompt || 'Describe the image'
    const image = imageToGenerativePart(req.file.path, req.file.originalname);
    try {
        const result = await model.generateContent([prompt, image])
        const response = await result.response;
        res.json({ output: response.text() });
    } catch (error) {
        res.status(500).json({
            error: error.message
        })
    } finally {
        fs.unlinkSync(req.file.path)
    }
})

app.post('/generate-from-document', upload.single('document'), async (req, res) => {
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString('base64');
    const mimeType = req.file.mimetype;

    try {
        const documentPart = {
            inlineData: { data: base64Data, mimeType }
        };

        const result = await model.generateContent([
            'Please summarize the following document in clear bullet points:',
            documentPart
        ]);

        const response = await result.response;
        res.json({ output: response.text() }); // ✅ fixed
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        fs.unlinkSync(filePath);
    }
});


app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
    const audioBuffer = fs.readFileSync(req.file.path)
    const base64Audio = audioBuffer.toString('base64')
    const filePath = req.file.path;
    const audioPart = {
        inlineData: {
            data: base64Audio,
            mimeType: req.file.mimetype
        }
    }
    try {
        const result = await model.generateContent([
            'Transcribe or analyze the folowing audio:', 
            audioPart
        ])
        const response = result.response
        res.json({ output: response.text() })
    } catch (error) {
        res.status(500).json({
            error: error.message
        })
    } finally {
        fs.unlinkSync(filePath)
    }
})

const PORT = 3000

app.listen(PORT, () => {
    console.log(`Gemini API server is running at http://localhost:${PORT}`)
})