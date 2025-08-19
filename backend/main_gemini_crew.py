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
    raise ValueError("GEMINI_API_KEY not found in .env")

# Remove quotes if present in API key
api_key = api_key.strip('"\'')

# Configure Gemini
genai.configure(api_key=api_key)

# ------------------------------
# CrewAI-like Classes (Custom Implementation)
# ------------------------------
class Agent:
    def __init__(self, role, goal, backstory, verbose=True, allow_delegation=False, llm=None):
        self.role = role
        self.goal = goal
        self.backstory = backstory
        self.verbose = verbose
        self.allow_delegation = allow_delegation
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    def execute(self, task_description, context=""):
        prompt = f"""
You are a {self.role}.
Your goal: {self.goal}
Your backstory: {self.backstory}

Task: {task_description}

Context: {context}

Execute this task professionally and return a high-quality result.
"""
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            return f"Error: {str(e)}"

class Task:
    def __init__(self, description, expected_output, agent):
        self.description = description
        self.expected_output = expected_output
        self.agent = agent
    
    def execute(self, inputs=None):
        context = ""
        if inputs:
            context = "\n".join([f"{k}: {v}" for k, v in inputs.items()])
        
        task_desc = self.description.format(**inputs) if inputs else self.description
        return self.agent.execute(task_desc, context)

class Process:
    sequential = "sequential"

class Crew:
    def __init__(self, agents, tasks, process=Process.sequential, memory=False):
        self.agents = agents
        self.tasks = tasks
        self.process = process
        self.memory = memory
    
    def kickoff(self, inputs=None):
        results = []
        context = ""
        
        for i, task in enumerate(self.tasks):
            if inputs:
                # Add previous results to inputs for context
                task_inputs = inputs.copy()
                task_inputs['previous_results'] = context
            else:
                task_inputs = {'previous_results': context}
            
            result = task.execute(task_inputs)
            results.append(result)
            
            # Build context for next task
            if i < len(self.tasks) - 1:  # Don't add to context for last task
                context += f"\n\nPrevious Task Result: {result}"
        
        # Create a result object that mimics CrewAI output
        class CrewResult:
            def __init__(self, content):
                self.raw = content
                self.content = content
            
            def __str__(self):
                return self.content
        
        return CrewResult(results[-1] if results else "No results")

# Mock LLM class for interface compatibility
class MockLLM:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    def invoke(self, prompt):
        class Response:
            def __init__(self, content):
                self.content = content
        
        try:
            response = self.model.generate_content(prompt)
            return Response(response.text.strip())
        except Exception as e:
            return Response(f"Error: {str(e)}")

# Create LLM instance
llm = MockLLM()

# ------------------------------
# Blog Generator Class (Exact same structure as main.py)
# ------------------------------
class InterviewBlogGenerator:
    def __init__(self):
        self.interviewer = Agent(
            role="Content Overview Specialist",
            goal="Provide clear overviews of planned blog content and incorporate user feedback.",
            backstory="""You are an expert content strategist who explains what will be covered in a blog post and gracefully incorporates user suggestions.""",
            verbose=True,
            allow_delegation=False,
            llm="gemini/gemini-2.0-flash"
        )
        self.researcher = Agent(
            role="Senior Research Analyst & Information Specialist",
            goal="Conduct comprehensive research and create detailed, fact-based blog outlines with current information and expert insights.",
            backstory="""You are an expert researcher with access to vast knowledge databases. You specialize in gathering comprehensive, accurate, and up-to-date information on any topic. You excel at finding specific details, statistics, examples, case studies, and expert opinions. You structure information in a way that's both informative and engaging for readers.""",
            verbose=True,
            allow_delegation=False,
            llm="gemini/gemini-2.0-flash"
        )
        self.writer = Agent(
            role="Expert Blog Writer & Content Specialist",
            goal="Write compelling, detailed, and highly specific blog posts that provide deep insights and actionable value to readers on their exact topic.",
            backstory="""You are a professional content creator with expertise across multiple domains. You write in-depth, topic-specific content that goes beyond generic advice. You adapt your writing style to match the topic's natural tone - whether technical, casual, academic, or conversational. You focus on providing specific examples, detailed explanations, and actionable insights rather than generic templates.""",
            verbose=True,
            allow_delegation=False,
            llm="gemini/gemini-2.0-flash"
        )
        self.stylist = Agent(
            role="Content Stylist and SEO Editor",
            goal="Format blogs with perfect Markdown, optimize for SEO, and ensure professional presentation.",
            backstory="You are an SEO and formatting expert who makes content look professional and search-engine friendly. You always return perfect JSON format.",
            verbose=True,
            allow_delegation=False,
            llm="gemini/gemini-2.0-flash"
        )
        self.research_task = Task(
            description="""Research the topic "{topic}" comprehensively using your knowledge base. Focus on:

DETAILED RESEARCH REQUIREMENTS:
- Gather specific facts, statistics, and data about "{topic}"
- Find historical background, key developments, and current status
- Identify important people, organizations, or entities related to "{topic}"
- Collect real-world examples, case studies, and success stories
- Research current trends, challenges, and future prospects
- Gather expert opinions, quotes, and authoritative sources
- Find specific details that most people wouldn't know about "{topic}"

CONTEXT ANALYSIS:
{context}

RESEARCH OUTPUT SHOULD INCLUDE:
- Comprehensive background information with specific details
- Key facts, figures, and statistics
- Important milestones, achievements, or developments
- Notable personalities or organizations involved
- Current trends and future outlook
- Practical applications and real-world impact
- Interesting lesser-known facts or insights
- Specific examples and case studies

Structure this as a detailed research brief with bullet points, facts, and comprehensive information that will enable writing an expert-level blog post.""",
            expected_output="A comprehensive research brief with detailed facts, statistics, examples, and expert insights",
            agent=self.researcher
        )
        self.write_task = Task(
            description="""Using the comprehensive research about "{topic}":
{context}
{previous_results}

Write a detailed, expert-level 1000-1500 word blog post that demonstrates deep knowledge of "{topic}":

CONTENT DEPTH REQUIREMENTS:
- Include SPECIFIC facts, statistics, and data from the research
- Mention real people, organizations, dates, and events related to "{topic}"
- Provide detailed explanations of concepts, processes, or methodologies
- Include concrete examples, case studies, and real-world applications
- Add historical context and background information
- Discuss current trends, challenges, and future prospects
- Include expert insights and authoritative information

WRITING STYLE:
- Write as a subject matter expert with insider knowledge
- Use industry-specific terminology appropriately
- Provide detailed analysis and deep insights
- Include specific numbers, percentages, dates, and measurable details
- Reference real examples and actual implementations
- Demonstrate comprehensive understanding of the topic

STRUCTURE & FORMATTING:
- Compelling introduction with hook and overview
- 4-6 main sections with descriptive, specific headings
- Include subheadings for better organization
- Use bullet points for lists and key information
- Add tables for comparative data or structured information
- Include specific examples in each major section
- Strong conclusion with actionable insights

SPECIFIC DETAILS TO INCLUDE:
- Exact names, dates, locations when relevant
- Specific statistics, percentages, or numerical data
- Real company names, product names, or case studies
- Historical milestones and important developments
- Current market size, trends, or growth figures
- Technical specifications or detailed processes
- Expert quotes or authoritative statements

Make this read like it was written by someone who has extensively studied "{topic}" and has insider knowledge of the field.""",
            expected_output="A comprehensive, fact-rich blog post with specific details and expert insights",
            agent=self.writer
        )
        self.style_task = Task(
            description="""Take the blog post and format it perfectly:

{previous_results}

Format requirements:
1. Add a catchy, SEO-friendly title
2. Use proper Markdown formatting (# ## ### **bold** *italic*)
3. Ensure good paragraph spacing
4. Highlight 5-10 important keywords with **bold**
5. Add a compelling meta description
6. Extract 8-10 relevant SEO keywords

Return as valid JSON:
{{
  "blogContent": "Full markdown formatted blog with title and all content",
  "summary": "2-3 sentence summary of the blog",  
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"]
}}

IMPORTANT: Return ONLY the JSON, no other text.""",
            expected_output="Valid JSON with blogContent, summary, and keywords",
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
            
            # Enhanced overview with research-based preview
            prompt = f"""You are an expert content researcher. The user wants a detailed blog about: {topic}

Create a comprehensive content overview that shows your research-based approach. Include:

**RESEARCH PREVIEW:**
- What specific aspects of "{topic}" you'll research and cover
- Key areas of investigation (history, current status, future trends, etc.)
- Types of detailed information you'll gather (facts, statistics, case studies, expert insights)

**CONTENT STRUCTURE:**
- Main sections with specific focus areas
- Types of examples and case studies you'll include
- Depth of coverage for each section

**VALUE PROPOSITION:**
- Specific insights readers will gain
- Expert-level details they won't find elsewhere
- Actionable information and practical applications

Format this as a well-structured overview with bullet points and clear sections. End with: "This will be a comprehensive, research-based blog with specific details and expert insights. If you want to add any particular focus areas or have specific requirements, let me know!"

Make it look professional and detailed to show the quality of content they'll receive."""
            
            try:
                response = llm.invoke(prompt)
                overview = response.content.strip()
                session["conversation"].append({"role": "agent", "content": overview})
                session.modified = True
                return overview
            except Exception as e:
                return f"I'll research and write a comprehensive, detailed blog about {topic} with specific facts, examples, and expert insights. If you have specific areas to focus on, let me know!"

        if user_answer:
            session["conversation"].append({"role": "user", "content": user_answer})
            session.modified = True
            
            # Acknowledge user input and confirm enhanced research
            return "Perfect! I'll incorporate those specific requirements into my detailed research and analysis. Ready to generate your comprehensive, fact-based blog post with expert insights!"

        # Fallback
        return "Ready to create your detailed, research-based blog! Click generate to start."

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
            
            # More aggressive JSON cleaning
            clean_json = re.sub(r"```json\n|\n```|```", "", raw_output).strip()
            
            # Remove any text before the first { and after the last }
            start_idx = clean_json.find('{')
            end_idx = clean_json.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                clean_json = clean_json[start_idx:end_idx+1]
            
            try:
                data = json.loads(clean_json)
                # Ensure all required fields exist
                if not isinstance(data.get('blogContent'), str):
                    raise ValueError("Invalid blogContent")
                if not isinstance(data.get('summary'), str):
                    data['summary'] = f"A comprehensive guide about {topic}"
                if not isinstance(data.get('keywords'), list):
                    data['keywords'] = [topic.lower(), "guide", "tips", "tutorial", "blog"]
                    
            except (json.JSONDecodeError, ValueError):
                # If JSON parsing fails, create a manual response
                data = {
                    "blogContent": f"# {topic}\n\n{raw_output}",
                    "summary": f"A comprehensive guide about {topic}",
                    "keywords": [topic.lower(), "guide", "tips", "tutorial", "blog"]
                }
                
        except Exception as e:
            data = {
                "blogContent": f"# Error Generating Blog\n\nSorry, there was an error: {str(e)}",
                "summary": "Error generating blog",
                "keywords": ["error"]
            }

        session.clear()
        return data

# Create an instance of the generator
blog_generator = InterviewBlogGenerator()

# --- API Routes (Exact same as main.py) ---
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

@app.route("/quick-generate", methods=["POST"])
def quick_generate():
    """Generate detailed blog directly without interview - for faster results"""
    try:
        data = request.get_json()
        topic = data.get("topic")
        additional_info = data.get("info", "")
        
        if not topic:
            return jsonify({"error": "Topic is required"}), 400
        
        # Create enhanced context for quick generation with more specific instructions
        context = f"""Create a detailed, expert-level blog post about: {topic}
        
REQUIREMENTS:
- Write as a subject matter expert with deep knowledge of {topic}
- Provide specific, actionable information rather than generic advice
- Include real-world examples, case studies, or practical scenarios
- Use appropriate industry terminology and concepts
- Make it comprehensive but accessible
- Include step-by-step guidance where applicable
- Add tables, lists, or structured information when relevant

Additional user requirements: {additional_info if additional_info else 'None - cover the topic comprehensively'}

Target length: 800-1200 words with proper structure and formatting."""
        
        result = blog_generator.blog_crew.kickoff(inputs={
            "topic": topic,
            "context": context
        })
        
        raw_output = result.raw if hasattr(result, "raw") else str(result)
        clean_json = re.sub(r"```json\n|\n```|```", "", raw_output).strip()
        
        # More aggressive JSON cleaning
        start_idx = clean_json.find('{')
        end_idx = clean_json.rfind('}')
        
        if start_idx != -1 and end_idx != -1:
            clean_json = clean_json[start_idx:end_idx+1]
        
        try:
            data = json.loads(clean_json)
            # Ensure all required fields exist
            if not isinstance(data.get('blogContent'), str):
                raise ValueError("Invalid blogContent")
            if not isinstance(data.get('summary'), str):
                data['summary'] = f"A comprehensive guide about {topic}"
            if not isinstance(data.get('keywords'), list):
                data['keywords'] = [topic.lower(), "guide", "tips", "tutorial", "blog"]
                
        except (json.JSONDecodeError, ValueError):
            data = {
                "blogContent": f"# {topic}\n\n{raw_output}",
                "summary": f"A comprehensive guide about {topic}",
                "keywords": [topic.lower(), "guide", "tips", "tutorial", "blog"]
            }
        
        return jsonify(data)
        
    except Exception as e:
        return jsonify({
            "blogContent": f"# Error\n\nError generating blog: {str(e)}",
            "summary": "Error generating blog",
            "keywords": ["error"]
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Starting Flask server on http://localhost:{port}")
    print(f"✅ Using Google AI Studio API with Gemini 2.0 Flash")
    print(f"🤖 Custom CrewAI implementation - fully compatible")
    app.run(port=port, debug=True)
