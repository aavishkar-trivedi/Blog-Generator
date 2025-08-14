from flask import Flask, request, jsonify
from flask_cors import CORS
from blog_generator import BlogGenerator
import os

app = Flask(__name__)
CORS(app)

try:
    # This now initializes the multi-agent crew system
    generator = BlogGenerator()
except Exception as e:
    print(f"🔥🔥🔥 FATAL ERROR during initialization: {e}")
    generator = None

@app.route('/generate', methods=['POST'])
def generate_blog_route():
    if not generator:
        return jsonify({"error": "The Blog Generator is not initialized. Check server logs for errors."}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body"}), 400
        
    topic = data.get('topic')
    tone = data.get('tone', 'professional')

    if not topic:
        return jsonify({"error": "Topic cannot be empty"}), 400

    print(f"✨ Received request for multi-agent job on: {topic}")
    
    # This kicks off the CrewAI process and returns the final JSON object
    structured_content = generator.generate_blog(topic, tone)
    
    print("✅ Crew job complete. Sending structured response.")
    # Flask automatically converts the Python dictionary to a JSON response
    return jsonify(structured_content)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Starting Flask server on http://localhost:{port}")
    app.run(debug=True, port=port)
