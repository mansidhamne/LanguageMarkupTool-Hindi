const audioPlayer = document.getElementById('audioPlayer');
const audioFileInput = document.getElementById('audioFile');
const transcriptFileInput = document.getElementById('transcriptFile');
const transcriptDisplay = document.getElementById('transcriptDisplay');
const exportButton = document.getElementById('exportButton');
const exportCsvButton = document.getElementById('exportCsvButton');
const resetButton = document.getElementById('resetButton');
const outputArea = document.getElementById('output');
const outputDiv = document.getElementById('outputArea');
const skipStoryButton = document.getElementById('skipButton');

let storyFiles = [];      
let numberOfStories = 0;
let shuffledOrder = [];
let currentStoryIndex = 0;
let userEmail = '';
let uploadedFileName = ""; 
let API_KEY = '';
let FOLDER_ID = '';

async function getKeys() {
    try {
      const response = await fetch('/api/keys'); 
      const data = await response.json();

      API_KEY = data.apiKey;
      FOLDER_ID = data.folderId;
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    }
}

async function fetchStoryFiles() {
    if (!API_KEY || !FOLDER_ID) {
        console.log("API keys not initialized.");
        return;
      }

    const url = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    storyFiles = data.files
        .filter(file => file.name.endsWith('.txt'))
        .sort((a, b) => a.name.localeCompare(b.name)) 
        .map(file => ({
            url: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`,
            name: file.name
        }));

    if (shuffledOrder.length > 0) {
        loadCurrentStory();
    }
    numberOfStories = storyFiles.length;
    // console.log(storyFiles)
    // console.log("Number of stories: ", numberOfStories);
}

async function startSession(email, language) {
  const res = await fetch('/start-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email, 
      language,
      storyNames: storyFiles.map(f => f.name)
    })
  });

  const data = await res.json();
//   console.log(data);

  shuffledOrder = Object.keys(data.storyOrder).sort((a, b) => data.storyOrder[a] - data.storyOrder[b]);
  currentStoryIndex = data.currentIndex;

  if (storyFiles.length > 0) {
    loadCurrentStory();
  }
}

  
async function updateProgress(email) {
    const res = await fetch('/update-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
//   console.log(data);

  if (data.success && data.nextStory) {
    currentStoryIndex = shuffledOrder.indexOf(data.nextStory);
  }
}

async function nextStory() {
    if (currentStoryIndex < shuffledOrder.length - 1) {
      await updateBackendProgress();  
      loadCurrentStory();
    } else {
      console.log("You have completed all the stories!");
      alert("You have completed all the stories!");
    }
}
  
async function updateBackendProgress() {
    await updateProgress(userEmail); 
}

function loadCurrentStory() {
    const storyName = shuffledOrder[currentStoryIndex];
    console.log("Loading story:", storyName);
    uploadedFileName = storyName;
  
    const story = storyFiles.find(file => file.name === storyName);
    if (!story) {
      console.error("Story file not found:", storyName);
      return;
    }
  
    fetch(story.url)
      .then(res => res.text())
      .then(text => {
        displayTranscript(text);
        updateProgressBar();
      })
      .catch(error => console.error("Error loading story:", error));
}

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const storyProgress = document.getElementById('storyProgress');

    progressBar.value = currentStoryIndex + 1;
    storyProgress.textContent = `Story ${currentStoryIndex + 1} of ${storyFiles.length}`;
}

let transcript = '';
let wordElements = [];
let spaceElements = [];
let activeGroups = [];
let currentGroupId = 0;

audioPlayer.style.display = 'none';

audioFileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const audioUrl = URL.createObjectURL(file);
        audioPlayer.src = audioUrl;
        audioPlayer.load();
        audioPlayer.style.display = 'block'; 
    } else {
        audioPlayer.style.display = 'none'; 
    }
});


document.getElementById("fileSelect").addEventListener("change", function() {
    const fileUrl = this.value;
    //console.log("Selected file URL:", fileUrl);
    if (fileUrl) {
        fetch(fileUrl)
        .then(response => response.text())
        .then(text => {
            console.log("File Content:", text);
            displayTranscript(text);
        })
        .catch(error => console.error("Error loading file:", error));
    }
});

function displayTranscript(text) {
    if(text){
        //console.log("Transcript text:", text);
    }
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const title = lines[0].trim();
    const story = lines.slice(1).join(' ').trim();
    //const story = "Tom found a tiny kitten. It followed him home. He gave it milk and took care of it. They became best friends forever." 
    const words = story.match(/\S+|\s+/g); 
    //console.log(words);
    transcriptDisplay.innerHTML = '';

    wordElements = [];
    spaceElements = [];
    activeGroups = [];
    currentGroupId = 0;

    for (let i = 0; i < words.length; i+=2) {  
        if (words[i].trim() !== '') {
            const wordSpan = document.createElement('span');
            wordSpan.classList.add('word');
            wordSpan.dataset.index = wordElements.length;
            wordSpan.dataset.hasPipe = 'false';
            wordSpan.dataset.groupId = '-1';
    
            let textContent = words[i];
            if (i + 1 < words.length) {
                textContent += words[i + 1];  
            }
    
            wordSpan.textContent = textContent;
    
            wordSpan.addEventListener('click', function (e) {
                const wordIndex = parseInt(this.dataset.index);
    
                if (this.dataset.hasPipe === 'true') {
                    this.dataset.hasPipe = 'false';
                    this.classList.remove('word-with-pipe');
                } else {
                    this.dataset.hasPipe = 'true';
                    this.classList.add('word-with-pipe');
                }
    
                updateGroups();
                updateOutput();
                updateOutputExport();
            });
    
            transcriptDisplay.appendChild(wordSpan);
            wordElements.push(wordSpan);
        }
    }
}

function updateGroups() {
    wordElements.forEach(word => {
        word.dataset.groupId = '-1';
        for (let i = 0; i < 6; i++) {
            word.classList.remove(`group-${i}`);
        }
    });

    spaceElements.forEach(space => {
        for (let i = 0; i < 6; i++) {
            space.classList.remove(`group-${i}`);
        }
    });

    activeGroups = [];
    currentGroupId = 0;
    let currentGroup = [];

    for (let i = 0; i < wordElements.length; i++) {
        const word = wordElements[i];
        const hasPipe = word.dataset.hasPipe === 'true';

        currentGroup.push(i);

        if (hasPipe) {
            if (currentGroup.length >= 1) {
                activeGroups.push([...currentGroup]);
                currentGroupId++;
            }
            currentGroup = [];
        }
    }

    for (let g = 0; g < activeGroups.length; g++) {
        const groupWords = activeGroups[g];
        const colorIndex = g % 6;

        for (let i = 0; i < groupWords.length; i++) {
            const wordIndex = groupWords[i];
            const word = wordElements[wordIndex];
            word.dataset.groupId = g.toString();
        }
    }
}

function updateOutputExport() {
    let result = '';

    for (let i = 0; i < wordElements.length; i++) {
        word = wordElements[i].textContent.trim();
        result += word;

        if (wordElements[i].dataset.hasPipe === 'true') {
            result += '|';
        }

        if (i < wordElements.length - 1) {
            result += ' ';
        }
    }

    outputArea.value = result;
}

function updateOutput() {
    outputDiv.innerHTML = ''; 

    outputDiv.style.whiteSpace = 'normal'; // <-- wrap text
    outputDiv.style.lineHeight = '1.6'; // Optional: nicer paragraph spacing

    for (let i = 0; i < wordElements.length; i++) {
        const wordEl = wordElements[i];
        const wordText = wordEl.textContent.trim();
        const hasPipe = wordEl.dataset.hasPipe === 'true';
        const groupId = parseInt(wordEl.dataset.groupId);

        const span = document.createElement('span');
        span.textContent = wordText + ' ';
        span.style.marginRight = '0px';
        span.style.display = 'inline';

        if (!isNaN(groupId) && groupId >= 0) {
            span.classList.add(`group-${groupId % 6}`);
            span.style.padding = '2px';
            span.style.borderRadius = '0px';
        } else if (groupId === -1) {
            span.style.padding = '2px';
            span.style.backgroundColor = "#ffffff";
        }

        outputDiv.appendChild(span);
    }
}

exportButton.addEventListener('click', function () {
    const blob = new Blob([outputArea.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript_with_markers.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

exportCsvButton.addEventListener('click', function () {
    let csvContent = "word,label\n";

    wordElements.forEach((wordEl) => {
        let word = wordEl.textContent;
        let hasPipe = wordEl.dataset.hasPipe;

        if (hasPipe === 'true') {
            label = 'None';
        }else {
            label = 0;
        }
        word = word.replace(/"/g, '""');
        csvContent += `"${word}","${label}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = uploadedFileName + '_transcript_with_markers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

resetButton.addEventListener('click', function () {
    wordElements.forEach(wordEl => {
        wordEl.dataset.hasPipe = 'false';
        wordEl.dataset.groupId = '-1';
        wordEl.classList.remove('word-with-pipe');

        for (let i = 0; i < 6; i++) {
            wordEl.classList.remove(`group-${i}`);
        }
    });

    spaceElements.forEach(spaceEl => {
        for (let i = 0; i < 6; i++) {
            spaceEl.classList.remove(`group-${i}`);
        }
    });

    activeGroups = [];
    currentGroupId = 0;
    updateOutput();
});

function processExistingPipes(text) {
    const words = text.split(/\s+/);
    let processedText = '';

    words.forEach((word, index) => {
        if (word.endsWith('|')) {
            processedText += word;
        } else {
            processedText += word;
        }

        if (index < words.length - 1) {
            processedText += ' ';
        }
    });

    return processedText;
}

document.getElementById("skipButton").addEventListener("click", function() {
    currentStoryIndex++;
    updateBackendProgress();
    console.log("Skipping to next story...");
    if (currentStoryIndex < storyFiles.length) {
        loadCurrentStory();
    } else {
        console.log("🎉 All stories completed!");
        window.location.href = 'thankyou.html';
    }
});

document.getElementById("sendDataButton").addEventListener("click", function() {
    const sendButton = document.getElementById("sendDataButton");
    sendButton.textContent = "Sending Data..."; 

    const params = new URLSearchParams(window.location.search);
    const name = params.get("name");
    const email = params.get("email");
    const proficiency = params.get("proficiency");

    if (!name || !email || !proficiency) {
        alert("User details missing. Please go back and fill the form.");
        return;
    }

    let csvContent = "word,label\n";

    wordElements.forEach((wordEl) => {
        let word = wordEl.textContent;
        let hasPipe = wordEl.dataset.hasPipe;

        if (hasPipe === 'true') {
            label = 'None';
        }else {
            label = 0;
        }
        // Escape quotes in the word if any
        word = word.replace(/"/g, '""');
        csvContent += `"${word}","${label}"\n`;
    });

    if (!csvContent) {
        alert("No marked data found. Please mark pauses before sending.");
        return;
    }

    if (!uploadedFileName) {
        alert("No text file uploaded. Please upload a transcript file.");
        return;
    }

    const payload = {
        userName: name,
        userEmail: email,
        proficiency: proficiency,
        fileName: uploadedFileName,
        csvData: csvContent,
        batch: "Batch-1-HI",
        language: "hi",
    };

    //console.log(payload);

    fetch("https://script.google.com/macros/s/AKfycbwNgRaR0Z73CeSPeK4y740Cm6M8sEW1IiheS-So8mYaZeDZBcKj21JlQVZIv8-ND_k2/exec", {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(() => {
        console.log("Data successfully sent! Continue to the next story.");

        outputDiv.innerHTML = ''; 
        sendButton.textContent = "Send Data"; 
        sendButton.disabled = false;

        currentStoryIndex++;
        updateBackendProgress();

        if (currentStoryIndex < storyFiles.length) {
            loadCurrentStory();
        } else {
            console.log("🎉 All stories completed!");
            window.location.href = 'thankyou.html';
        }
    })
    .catch(err => {
        console.log("Error sending data: " + err);
        alert("Failed to send data. Please try again.");
    });
});

async function initSession(email, language) {
    userEmail = email;
    await getKeys();
    await fetchStoryFiles();        
    await startSession(email, language);   
  }

window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");

    if (email) {
        initSession(email, "hi");
    } else {
        console.error("Email parameter is missing in the URL.");
        alert("Email parameter is missing. Please go back and fill the form.");
    }
});
