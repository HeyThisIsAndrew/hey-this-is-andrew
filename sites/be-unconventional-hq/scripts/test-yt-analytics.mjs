import dotenv from 'dotenv';

dotenv.config();

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;

if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    console.error("Missing YouTube OAuth credentials in .env");
    process.exit(1);
}

async function testAuth() {
    try {
        console.log("Attempting token exchange...");
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: YOUTUBE_CLIENT_ID,
                client_secret: YOUTUBE_CLIENT_SECRET,
                refresh_token: YOUTUBE_REFRESH_TOKEN,
                grant_type: 'refresh_token'
            })
        });
        
        const data = await response.json();
        if (data.access_token) {
            console.log("Successfully retrieved access token!");
        } else {
            console.log("Failed to get access token:", data);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
testAuth();
