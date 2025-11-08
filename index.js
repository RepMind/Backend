const express = require('express') // import statement
const prisma = require('./prisma/client')

const app = express();
const PORT = 3000

//define endpoints
//get, post, put, delete
app.use(express.json())

async function gptHandler(prompt) {
    try {
    const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
        model: "gpt-4o-mini",
        messages: [
        { role: "system", content: "You are a helpful fitness trainer." },
        { role: "user", content: prompt }
        ]
    },
    {
        headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        }
    });
    // Return the generated text
        return response.data.choices[0].message.content;
    } 
        catch (error) {
            console.error("Error calling OpenAI:", error.response?.data || error.message);
        throw error;
    }
}    

//Create new user

app.post('/', async(req, res) => {
    console.log(req.body)
    try{
        const result = await prisma.user_info.create({
            data: {
                user_id: req.body.user_id,
                age: req.body.age,
                height_cm: req.body.height_cm,
                weight_kg: req.body.weight_kg,
                gender: req.body.gender,
                goal: req.body.goal,
                experience_level: req.body.experience_level,
                limitations: req.body.limitations,
                available_days: req.body.available_days,
            },
        });
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({error: error.message});
    }
})

app.get('/', (req, res) => {
    res.status(200).json("200 ok successful response")
})

app.listen(PORT, () => {
    console.log("Server running at port: ", PORT)
})