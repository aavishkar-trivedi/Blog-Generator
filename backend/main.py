import os
import json
import re
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process
# --- FIX: Import the correct LLM class from the new library ---
from langchain_google_genai import ChatGoogleGenerativeAI

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
    raise ValueError("GEMINI_API_KEY not found in .env")

# --- FIX: Initialize the LLM using the LangChain integration ---
# This is more compatible with CrewAI and uses the requested model
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash",
                           verbose=True,
                           temperature=0.5,
                           google_api_key=api_key)


# This class structure is good for organization
class InterviewBlogGenerator:
    def __init__(self):
        self.interviewer = Agent(
            role="Curious Content Planner",
            goal="Ask smart, specific follow-up questions before writing.",
            backstory="""You are like a journalist preparing an article, 
            and you never start until you have enough details.""",
            verbose=True,
            allow_delegation=False,
            llm="gemini/gemini-2.0-flash"

        )
        self.researcher = Agent(
            role="Senior Research Analyst",
            goal="Research {topic} using {context} from the interview.",
            backstory="You create a detailed, structured outline.",
            verbose=True,
            allow_delegation=False,
            llm="gemini/gemini-2.0-flash"

        )
        self.writer = Agent(
            role="Expert Blog Writer",
            goal="Write an engaging blog post from the outline and user details.",
            backstory="You write like a professional blogger.",
            verbose=True,
            allow_delegation=False,
           llm="gemini/gemini-2.0-flash"

        )
        self.stylist = Agent(
            role="Content Stylist and Editor",
            goal="Format the blog with Markdown and keywords, return as JSON.",
            backstory="You output perfect JSON with blogContent, summary, keywords.",
            verbose=True,
            allow_delegation=False,
            llm="gemini/gemini-2.0-flash"

        )
        self.research_task = Task(
            description="""Based on the topic "{topic}" and user details:
{context}
Create a structured blog outline.""",
            expected_output="A bullet-point outline",
            agent=self.researcher
        )
        self.write_task = Task(
            description="""Using the outline and context:
{context}
Write a 600-800 word blog post.""",
            expected_output="A full blog post",
            agent=self.writer
        )
        self.style_task = Task(
            description="""Format the blog in Markdown.
Highlight 5-10 important keywords with **bold**.
Return JSON with blogContent, summary, and keywords.""",
            expected_output="A valid JSON object",
            agent=self.stylist
        )
        self.blog_crew = Crew(
            agents=[self.researcher, self.writer, self.stylist],
            tasks=[self.research_task, self.write_task, self.style_task],
            process=Process.sequential,
            memory=False
        )

    def interview_step(self, topic, user_answer=None):
        if "conversation" not in session:
            session["conversation"] = []
            session["topic"] = topic

        if user_answer:
            session["conversation"].append({"role": "user", "content": user_answer})
        
        session.modified = True

        convo_text = "\n".join(
            f"{t['role'].capitalize()}: {t['content']}" for t in session["conversation"]
        )

        prompt = f"""The user wants a blog on: {session['topic']}.
Conversation so far:
{convo_text}

If you still need more details, ask the next question.
If you have enough details, say: READY TO WRITE and summarize info gathered."""
        
        # --- FIX: Use the .invoke() method, standard for LangChain LLMs ---
        response = llm.invoke(prompt)
        question = response.content.strip()

        session["conversation"].append({"role": "agent", "content": question})
        session.modified = True

        return question

    def generate_blog(self):
        topic = session.get("topic")
        conversation = session.get("conversation", [])
        context = "\n".join(f"{t['role']}: {t['content']}" for t in conversation)

        try:
            result = self.blog_crew.kickoff(inputs={
                "topic": topic,
                "context": context
            })
            raw_output = result.raw if hasattr(result, "raw") else str(result)
            clean_json = re.sub(r"```json\n|\n```", "", raw_output).strip()
            data = json.loads(clean_json)
        except Exception as e:
            data = {
                "blogContent": f"Error: {e}",
                "summary": "Error generating blog",
                "keywords": []
            }

        session.clear()
        return data

# Create an instance of the generator
blog_generator = InterviewBlogGenerator()

# --- API Routes ---
@app.route("/interview", methods=["POST"])
def interview():
    data = request.get_json()
    topic = data.get("topic")
    user_answer = data.get("answer")
    question = blog_generator.interview_step(topic, user_answer)
    return jsonify({"question": question})

@app.route("/generate", methods=["POST"])
def generate():
    data = blog_generator.generate_blog()
    return jsonify(data)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Starting Flask server on http://localhost:{port}")
    app.run(port=port, debug=True)
