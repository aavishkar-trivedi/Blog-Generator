import os
import json
import re
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process
import google.generativeai as genai

# ------------------------------
# Load env variables
# ------------------------------
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env")

genai.configure(api_key=api_key)
# Using the recommended 'gemini-2.0-flash' model for performance
llm = genai.GenerativeModel('gemini-2.0-flash')

# ------------------------------
# Flask setup
# ------------------------------
app = Flask(__name__)
# A secret key is required for Flask sessions to work
app.secret_key = os.urandom(24) # Generates a secure, random secret key
CORS(app, supports_credentials=True) # supports_credentials=True is needed for sessions

# ------------------------------
# Agents
# ------------------------------
interviewer = Agent(
    role="Curious Content Planner",
    goal="Engage the user in a natural Q&A to fully understand their needs before writing.",
    backstory="""You are like a professional journalist. 
    You always ask smart, specific, and relevant follow-up questions 
    until you have enough details to write a high-quality blog.""",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

researcher = Agent(
    role="Senior Research Analyst",
    goal="Uncover deep insights about {topic} using {context}",
    backstory="""You gather and organize detailed information 
    into a clear blog outline.""",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

writer = Agent(
    role="Expert Blog Writer",
    goal="Write a compelling blog post based on the research and user details.",
    backstory="""You craft engaging, structured, and easy-to-read blog posts.""",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

stylist = Agent(
    role="Content Stylist and Editor",
    goal="Format the blog in Markdown, highlight important keywords, and produce a JSON output.",
    backstory="""You are a detail-oriented editor who outputs a clean JSON 
    with blogContent, summary, and keywords.""",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

# ------------------------------
# Tasks
# ------------------------------
research_task = Task(
    description="""Based on the topic "{topic}" and details:
{context}
Create a structured outline for the blog.""",
    expected_output="A bullet-point outline",
    agent=researcher
)

write_task = Task(
    description="""Using the outline and context:
{context}
Write a 600-800 word blog post in plain text.""",
    expected_output="A full blog post",
    agent=writer
)

style_task = Task(
    description="""Format the blog in Markdown. 
Highlight 5-10 important keywords with **bold**. 
Then return a JSON with blogContent, summary, and keywords.""",
    expected_output="A valid JSON object",
    agent=stylist
)

blog_crew = Crew(
    agents=[researcher, writer, stylist],
    tasks=[research_task, write_task, style_task],
    process=Process.sequential,
    # --- FIX: Disabled memory to prevent ChromaDB/OpenAI dependency error ---
    memory=False 
)

# ------------------------------
# API Routes
# ------------------------------
@app.route("/interview", methods=["POST"])
def interview():
    data = request.get_json()
    topic = data.get("topic")
    user_answer = data.get("answer")

    if "conversation" not in session:
        session["conversation"] = []
        session["topic"] = topic

    if user_answer:
        session["conversation"].append({"role": "user", "content": user_answer})

    convo_text = "\n".join(
        f"{turn['role'].capitalize()}: {turn['content']}"
        for turn in session["conversation"]
    )

    prompt = f"""The user wants a blog on: {session['topic']}.
Conversation so far:
{convo_text}

If you still need more details, ask the next question.
If you have enough details, say: READY TO WRITE and briefly summarize the info gathered."""
    
    # Using the llm directly for the interview part
    response = llm.generate_content(prompt)
    question = response.text.strip()
    
    session["conversation"].append({"role": "agent", "content": question})
    session.modified = True

    return jsonify({"question": question})


@app.route("/generate", methods=["POST"])
def generate_blog():
    topic = session.get("topic")
    conversation = session.get("conversation", [])
    
    if not topic:
        return jsonify({"error": "No topic found in session. Please start the interview process first."}), 400

    extra_context = "\n".join(f"{t['role']}: {t['content']}" for t in conversation)

    try:
        result = blog_crew.kickoff(inputs={
            "topic": topic,
            "context": extra_context
        })
        raw_output = result.raw if hasattr(result, "raw") else str(result)
        # Handle potential markdown code fences around the JSON
        clean_json = re.sub(r"```json\n|\n```", "", raw_output, flags=re.MULTILINE).strip()
        data = json.loads(clean_json)
    except Exception as e:
        print(f"Error during blog generation: {e}")
        data = {
            "blogContent": f"## An Error Occurred\n\nCould not generate the blog post.\n\n**Error Details:**\n`{str(e)}`",
            "summary": "Error generating blog",
            "keywords": ["error"]
        }

    session.clear()
    return jsonify(data)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Starting Flask server on http://localhost:{port}")
    app.run(port=port, debug=True)
