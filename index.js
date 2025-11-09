const express = require('express') // import statement
const prisma = require('./prisma/client')
const axios = require('axios')

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
        { role: "system", content: "You are a helpful fitness trainer. Return the muscle group for the workout in the format (Day/Muscle Group) followed by the exercises in json format: exercise name (varchar), sets (int), reps (varchar)"},
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
        const prompt = `The client is a ${req.body.age} year old ${req.body.gender} ${req.body.height_cm} cm tall 
                        weighing ${req.body.weight_kg} kgs. They have a goal of ${req.body.goal} with ${req.body.experience_level} 
                        experience, available to work out on ${req.body.available_days} weekly, and have the following limitations: 
                        ${req.body.limitations}. Generate a workout plan that suits them. Return listing each exerise by name, 
                        number of sets, number of reps, and which muscle group it targets.`
        const gpt_response = await gptHandler(prompt)
        console.log(gpt_response)

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