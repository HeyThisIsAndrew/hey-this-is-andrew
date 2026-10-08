import dotenv from 'dotenv';
dotenv.config();

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;

async function run() {
    // 1. Get Access Token
    const authRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: YOUTUBE_CLIENT_ID,
            client_secret: YOUTUBE_CLIENT_SECRET,
            refresh_token: YOUTUBE_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        })
    });
    const { access_token } = await authRes.json();
    if (!access_token) return console.error("No access token");

    const today = new Date().toISOString().split('T')[0];
    const startDate = '2020-01-01'; // 2020 is safe
    
    // Test 1: Average Viewer Retention (No Dimensions)
    const url1 = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${today}&metrics=averageViewPercentage`;
    const res1 = await fetch(url1, { headers: { Authorization: `Bearer ${access_token}` } });
    console.log("Retention:", await res1.json());

    // Test 2: Age and Gender
    const url2 = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${today}&dimensions=ageGroup,gender&metrics=viewerPercentage`;
    const res2 = await fetch(url2, { headers: { Authorization: `Bearer ${access_token}` } });
    console.log("Demographics:", await res2.json());

    // Test 3: Top Geos
    const url3 = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${today}&dimensions=country&metrics=views&sort=-views&maxResults=3`;
    const res3 = await fetch(url3, { headers: { Authorization: `Bearer ${access_token}` } });
    console.log("Geos:", await res3.json());
}
run();
