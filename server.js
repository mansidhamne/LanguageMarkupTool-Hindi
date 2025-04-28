require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch(err => console.error("MongoDB error:", err));

const userSchema = new mongoose.Schema({
  email: String,
  storyOrder: Object,       
  currentIndex: Number,
  language: String
});

const User = mongoose.model('User', userSchema);

app.post('/start-session', async (req, res) => {
  const { email, language, storyNames } = req.body;
    //console.log("Story Names", storyNames)
  let user = await User.findOne({ email, language });

  if (user) {
    const storyAtIndex = Object.keys(user.storyOrder).find(
      story => user.storyOrder[story] === user.currentIndex
    );
    return res.json({
      success: true,
      newSession: false,
      currentIndex: user.currentIndex,
      storyOrder: user.storyOrder,
      currentStory: storyAtIndex
    });
  } else {
    const shuffled = [...storyNames];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const storyOrder = {};
    shuffled.forEach((name, idx) => {
        storyOrder[name] = idx;
    });
    user = new User({ email, storyOrder, currentIndex: 0, language });
    await user.save();
    return res.json({
      success: true,
      newSession: true,
      currentIndex: 0,
      storyOrder,
      currentStory: shuffled[0]
    });
  }
});

app.post('/update-progress', async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const stories = Object.keys(user.storyOrder);
  const maxIndex = stories.length - 1;

  if (user.currentIndex < maxIndex) {
    user.currentIndex += 1;
    await user.save();
    const nextStory = stories.find(story => user.storyOrder[story] === user.currentIndex);
    return res.json({ success: true, currentIndex: user.currentIndex, nextStory });
  } else {
    return res.json({ success: true, message: "End of stories" });
  }
});

app.get('/api/keys', (req, res) => {
    const API_KEY = process.env.GOOGLE_API_KEY;
    const FOLDER_ID = process.env.FOLDER_ID;
  
    if (!API_KEY || !FOLDER_ID) {
      return res.status(500).json({ error: 'Missing API key or folder ID in environment variables.' });
    }
  
    res.json({
      apiKey: API_KEY,
      folderId: FOLDER_ID
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
