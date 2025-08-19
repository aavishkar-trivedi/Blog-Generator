import os
import json
import re
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

# ------------------------------
# Flask setup
# ------------------------------
app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

# ------------------------------
# Load env variables and configure AI
# ------------------------------
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("❌ GEMINI_API_KEY not found in .env file")

# Remove quotes if present in API key
api_key = api_key.strip('"\'')

# Configure Gemini
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

# ------------------------------
# Blog Generator Class
# ------------------------------
class InterviewBlogGenerator:
    def __init__(self):
        self.model = model

    # Step 1: Interview step
    def interview_step(self, topic, user_answer=None):
        if "conversation" not in session:
            session["conversation"] = []
            session["topic"] = topic

        if user_answer:
            session["conversation"].append({"role": "user", "content": user_answer})

        convo_text = "\n".join(
            f"{t['role'].capitalize()}: {t['content']}" for t in session["conversation"]
        )

        prompt = f"""You are a skilled interviewer gathering information for a blog post about: {session['topic']}.

Conversation so far:
{convo_text}

Your task:
1. If you have enough information to write a comprehensive blog (at least 3-4 good details), respond with exactly: "READY TO WRITE" followed by a summary of what you'll write about.
2. If you need more information, ask ONE specific, engaging question to gather more details.

Keep questions conversational and focused on getting concrete examples, personal experiences, or specific details that would make the blog interesting and valuable.

Current question limit: 5 questions maximum."""

        try:
            response = self.model.generate_content(prompt)
            question = response.text.strip()
            
            session["conversation"].append({"role": "agent", "content": question})
            session.modified = True
            return question
        except Exception as e:
            return f"Error in interview: {str(e)}"

    # Step 2: Blog generation
    def generate_blog(self):
        topic = session.get("topic")
        conversation = session.get("conversation", [])
        context = "\n".join(f"{t['role']}: {t['content']}" for t in conversation)

        prompt = f"""Based on the topic "{topic}" and the following conversation context, write a comprehensive blog post:

{context}

Create a professional blog post with:

1. **Catchy Title** - Engaging and SEO-friendly
2. **Introduction** - Hook the reader (2-3 sentences)  
3. **Main Content** - Well-structured sections with headings
4. **Conclusion** - Summarize key points (3-4 sentences)
5. **Summary** - Brief 2-3 sentence TL;DR
6. **Keywords** - 5-10 SEO-friendly keywords

Requirements:
- 600-800 words
- Use markdown formatting (# ## **bold** *italic*)
- Short paragraphs (3-4 sentences max)
- Professional but engaging tone
- Include specific examples from the conversation

Return ONLY valid JSON in this exact format:
{{
  "blogContent": "...markdown formatted blog content...",
  "summary": "...brief summary...",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}}"""

        try:
            response = self.model.generate_content(prompt)
            raw_output = response.text.strip()
            
            # Clean the JSON output
            clean_json = re.sub(r"```json\n|\n```|```", "", raw_output).strip()
            
            # Try to parse JSON
            try:
                data = json.loads(clean_json)
            except json.JSONDecodeError:
                # If JSON parsing fails, create a manual response
                data = {
                    "blogContent": f"# {topic}\n\n{raw_output}",
                    "summary": f"A comprehensive guide about {topic}",
                    "keywords": [topic.lower(), "guide", "tips", "tutorial", "guide"]
                }
            
            session.clear()
            return data
            
        except Exception as e:
            session.clear()
            return {
                "blogContent": f"# Error Generating Blog\n\nSorry, there was an error generating your blog: {str(e)}",
                "summary": "Error generating blog content",
                "keywords": ["error"]
            }


# ------------------------------
# Flask Routes
# ------------------------------
blog_generator = InterviewBlogGenerator()

@app.route("/interview", methods=["POST"])
def interview():
    try:
        data = request.get_json()
        topic = data.get("topic")
        user_answer = data.get("answer")
        
        if not topic and not session.get("topic"):
            return jsonify({"error": "Topic is required"}), 400
            
        question = blog_generator.interview_step(topic, user_answer)
        return jsonify({"question": question})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = blog_generator.generate_blog()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "model": "gemini-1.5-flash"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Server running at http://localhost:{port}")
    print(f"✅ Using Google AI Studio API with Gemini 1.5 Flash")
    app.run(port=port, debug=True)
