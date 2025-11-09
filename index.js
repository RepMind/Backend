const express = require('express') // import statement
const prisma = require('./prisma/client')
const axios = require('axios')

const app = express();
const PORT = 3000

//define endpoints
//get, post, put, delete
app.use(express.json())

// Get all workouts for a specific user
async function getWorkoutsByUserId(user_id) {
    try {
      const workouts = await prisma.workouts.findMany({
        where: { 
          plan_id: user_id, // plan_id in workouts matches user_id in user_info
        },
        include: {
          logs: true, // optional: include workout logs
        },
      });
  
      return workouts;
    } catch (error) {
      console.error("Error fetching user workouts:", error);
      throw new Error("Failed to fetch workouts");
    }
  }

// Get route for user workouts
app.get('/user/:user_id/workouts', async (req, res) => {
    const { user_id } = req.params;
    try {
      const workouts = await getWorkoutsByUserId(user_id);
      if (workouts.length === 0) {
        return res.status(404).json({ message: "No workouts found for this user" });
      }
      res.status(200).json({
        user_id,
        total_workouts: workouts.length,
        workouts,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
// Use chatgpt to generate a progress report based on user logs
function createProgressPrompt(userData) {
    let prompt = `
        User Info:
        - Age: ${userData.age}
        - Gender: ${userData.gender}
        - Goal: ${userData.goal}
        Here are their logged workouts and notes:
        `;
    for (const workout of userData.workouts) {
      prompt += `\nWorkout: ${workout.workout_name}\n`;
      for (const log of workout.logs) {
        prompt += `  • Date: ${new Date(log.completed_at).toLocaleDateString()} — ${log.notes || "No notes"}\n`;
      }
    }
    prompt += `\nBased on this data, summarize the user’s progress, improvements, and suggestions for next week.`;
    return prompt;
  }

app.get('/api/progress/:user_id', async (req, res) => {
try {
    const userData = await prisma.user_info.findUnique({
    where: { user_id: req.params.user_id },
    include: {
        workouts: {
        include: {
            logs: true,
        },
        },
    },
    });

    if (!userData) {
    return res.status(404).json({ error: "User not found" });
    }

    const prompt = createProgressPrompt(userData);
    const report = await gptReport(prompt);

    res.status(200).json({ progress_report: report });
} catch (error) {
    console.error("Error generating progress report:", error);
    res.status(500).json({ error: error.message });
}
});

async function gptReport(prompt) {
    try {
    const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
        model: "gpt-4o-mini",
        messages: [
        { role: "system", content: "You are a fitness coach generating a personalized progress report."},
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

//Logging the workout and notes 
app.post("/log",async(req, res) => {
    await prisma.logs.create({
        data: {
            user_id: req.data.user_id,
            workout_id: req.data.workout_id,
            notes: req.data.notes,
        }
    })
})

//Adds ChatGPT generated workout plan into database table
async function createWorkout(plan_id, gpt_plan) {
    console.log(plan_id, "Create Workout called") 
    const plan = JSON.parse(gpt_plan)
    for (const workout of plan) {
        await prisma.workouts.create({
            data: {
                plan_id: plan_id,
                workout_name: workout.workout_name,
                days: workout.days,
                exercise: workout.exercises,
            },
        });
    }
}

//Calls ChatGPT to generate workout plan
async function gptHandler(prompt) {
    try {
    const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
        model: "gpt-4o-mini",
        messages: [
        { role: "system", content: "You are a helpful fitness trainer. Generate a workout plan for a client based on their profile. Return the plan in strict JSON format with the following structure:[{'workout_name': 'push/pull/legs/etc', 'days': [0,1,2], 'exercises':[{'exercise_name': 'string','sets': integer,'reps': 'string','muscle_group': 'string'}]}]. Workout_name: the type of workout (Push, Pull, Legs, Full Body, etc.). Days: an array of integers representing the days of the week the client should perform this workout (0 = Sunday, 6 = Saturday). Exercises: a list of exercises for that workout including the number of sets, reps, and the primary muscle group targeted. Use the client’s information: age, gender, height, weight, goal, experience level, available days, and limitations to generate exercises. Avoid exercises that could worsen any limitations. Do not include any nonessential text before or after the JSON. Ensure the JSON is valid and can be parsed directly."},
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

//Create new user entry in database table and generate workout plan
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
        createWorkout(req.body.user_id, gpt_response)

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