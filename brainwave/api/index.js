export async function getPrediction(minutes){
    const response = await fetch(`https://brainwave-api.example.com/predict/?minutes=${minutes}`);
    const json = await response.json();
    return json.prediction;
       
}