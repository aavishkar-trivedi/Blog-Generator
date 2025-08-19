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

        prompt = f"""You are a curious content planner preparing to write a blog post about: {session['topic']}.

Conversation so far:
{convo_text}

Your job is to ask smart, specific follow-up questions to gather enough details before writing the blog.

If you still need more details about the topic, ask ONE specific, engaging question that will help you understand:
- The user's experience or perspective
- Specific examples or stories
- Target audience
- Key points they want to cover
- Personal insights or lessons learned

If you have enough information to write a comprehensive blog post, respond with exactly: "READY TO WRITE" followed by a summary of the information gathered.

Ask your next question:"""

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
        topic = session.get("topic", "Unknown Topic")
        conversation = session.get("conversation", [])
        context = "\n".join(f"{t['role']}: {t['content']}" for t in conversation)

        # Multi-step blog generation process
        try:
            # Step 1: Research and create outline
            outline_prompt = f"""Based on the topic "{topic}" and the following user details:

{context}

Create a detailed blog outline with:
1. A catchy title
2. Introduction points
3. 3-4 main sections with subpoints
4. Conclusion points
5. Key takeaways

Format as a structured outline."""

            outline_response = self.model.generate_content(outline_prompt)
            outline = outline_response.text

            # Step 2: Write the blog content
            writing_prompt = f"""Using this outline:

{outline}

And this context from the user:
{context}

Write a comprehensive, engaging blog post of 600-800 words. Make it:
- Professional yet conversational
- Include specific examples and insights
- Use clear structure with headers
- Engaging for readers interested in {topic}"""

            blog_response = self.model.generate_content(writing_prompt)
            raw_blog = blog_response.text

            # Step 3: Format and structure the final blog
            formatting_prompt = f"""Take this blog content and format it into a professional article with proper structure:

{raw_blog}

Format it with this structure:
1. **Title** → Catchy & attention-grabbing
2. **Introduction** → Brief 2-3 sentences
3. **Main Sections** → Use ## for section headers
4. **Conclusion** → 3-4 sentences summarizing key points
5. **Key Takeaways** → Bullet points of main insights

Use Markdown formatting:
- # for the main title
- ## for section headers  
- **bold** for emphasis
- Short paragraphs (3-4 sentences max)
- Clear spacing between sections

Also provide:
- A brief summary (2-3 sentences)
- 5-8 relevant keywords for SEO

Return the response in this exact JSON format:
{
  "blogContent": "markdown formatted blog content here",
  "summary": "brief summary here",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}"""

            final_response = self.model.generate_content(formatting_prompt)
            raw_output = final_response.text.strip()
            
            # Clean and parse JSON
            clean_json = re.sub(r"```json\n|\n```", "", raw_output).strip()
            
            try:
                data = json.loads(clean_json)
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                data = {
                    "blogContent": raw_blog,
                    "summary": f"A comprehensive blog post about {topic}",
                    "keywords": [topic.lower(), "blog", "guide", "tips", "insights"]
                }

        except Exception as e:
            data = {
                "blogContent": f"# Error Generating Blog\n\nSorry, there was an error generating your blog about {topic}.\n\nError: {str(e)}",
                "summary": "Error generating blog content",
                "keywords": ["error", "blog", "generation"]
            }

        session.clear()
        return data

    # Alternative: Quick blog generation without interview
    def generate_quick_blog(self, topic, additional_context=""):
        prompt = f"""Write a comprehensive, engaging blog post about: {topic}

Additional context: {additional_context}

Create a professional blog post with:
1. Catchy title
2. Engaging introduction
3. 3-4 main sections with clear headers
4. Practical insights and examples
5. Strong conclusion
6. Key takeaways

Make it 600-800 words, well-structured, and valuable for readers.

Format using Markdown and return as JSON:
{{
  "blogContent": "markdown formatted blog here",
  "summary": "brief summary here", 
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}}"""

        try:
            response = self.model.generate_content(prompt)
            raw_output = response.text.strip()
            clean_json = re.sub(r"```json\n|\n```", "", raw_output).strip()
            
            try:
                data = json.loads(clean_json)
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                data = {
                    "blogContent": f"# {topic}\n\n{response.text}",
                    "summary": f"A blog post about {topic}",
                    "keywords": [topic.lower(), "blog", "guide", "tips"]
                }
            
            return data
        except Exception as e:
            return {
                "blogContent": f"# Error\n\nError generating blog: {str(e)}",
                "summary": "Error occurred",
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
        
        if not topic and not user_answer:
            return jsonify({"error": "Topic or answer required"}), 400
            
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

@app.route("/quick-generate", methods=["POST"])
def quick_generate():
    try:
        data = request.get_json()
        topic = data.get("topic")
        context = data.get("context", "")
        
        if not topic:
            return jsonify({"error": "Topic is required"}), 400
            
        result = blog_generator.generate_quick_blog(topic, context)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "message": "Blog generator API is running"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Server running at http://localhost:{port}")
    print(f"🔑 Using Gemini API Key: {'✅ Found' if api_key else '❌ Missing'}")
    app.run(port=port, debug=True)
