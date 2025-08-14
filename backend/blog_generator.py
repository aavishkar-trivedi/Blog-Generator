import os
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process
import google.generativeai as genai
import json
import re

# Load environment variables
load_dotenv()

# --- AGENT DEFINITIONS ---

# Configure the LLM
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env file.")

genai.configure(api_key=api_key)
llm = genai.GenerativeModel('gemini/gemini-1.5-flash')

# 1. Researcher Agent
researcher = Agent(
  role='Senior Research Analyst',
  goal='Uncover groundbreaking trends and deep insights about {topic}',
  backstory="""You are a world-class research analyst, renowned for your ability to distill complex information into a clear, compelling, and structured narrative. 
  Your primary goal is to create a comprehensive and engaging outline that serves as the perfect blueprint for a viral blog post.""",
  verbose=True,
  allow_delegation=False,
  llm=llm
)

# 2. Writer Agent
writer = Agent(
  role='Expert Blog Post Writer',
  goal='Write a viral, engaging, and human-like blog post based on a given outline',
  backstory="""You are a world-class blog writer, famous for your ability to craft viral content that is both informative and deeply engaging. 
  You have a knack for storytelling, breaking down complex topics into digestible, bite-sized paragraphs, and maintaining a conversational, human-like tone. 
  Your writing avoids jargon and clichés, focusing instead on clarity, wit, and originality. You are a master of grammar and spelling.""",
  verbose=True,
  allow_delegation=False,
  llm=llm
)

# 3. Stylist & Reviewer Agent
stylist = Agent(
    role='Content Stylist and Editor',
    goal='Review a blog post, enhance its formatting, and generate a summary and keywords in a structured JSON format.',
    backstory="""You are a meticulous editor with a keen eye for detail and style. You ensure every piece of content is perfectly formatted, 
    engaging, and easy to read. You are an expert in Markdown and creating structured data outputs.""",
    verbose=True,
    allow_delegation=False,
    llm=llm
)


# --- TASK DEFINITIONS ---

research_task = Task(
  description='Conduct in-depth research on {topic} and create a comprehensive and compelling outline for a blog post. The outline must include an introduction that hooks the reader, at least 5 distinct and interesting sub-topics, and a thought-provoking conclusion.',
  expected_output='A detailed, multi-level bullet-point outline for a blog post about {topic} that is ready for a writer to expand upon.',
  agent=researcher
)

write_task = Task(
  description='Using the provided outline, write a full blog post of 600-800 words. The post should be captivating, easy to read, and feel like it was written by a human. Break down long ideas into smaller, well-structured paragraphs. Ensure the tone is engaging and avoids overly formal language. Check for spelling and grammar errors meticulously.',
  expected_output='A complete, well-written blog post in plain text, perfectly following the structure and intent of the outline.',
  agent=writer
)

# --- REFINED TASK ---
style_task = Task(
    description="""Review the provided blog post. Your final output MUST be a single, valid JSON object.
    1.  **Format the Blog Content**: Add Markdown formatting. **Do not add a main title using '#'.** Start the content directly with the first paragraph. Use subheadings (`##`) for different sections. Most importantly, **identify and wrap at least 5-10 of the most important keywords and phrases in bold** using double asterisks (`**word**`). This is crucial for readability.
    2.  **Summarize**: Write a concise 2-3 sentence summary of the article.
    3.  **Extract Keywords**: Extract 5-7 relevant keywords as an array of strings.
    
    The JSON object must have these exact keys: "blogContent", "summary", "keywords".""",
    expected_output='A single JSON object containing the formatted blog content (starting with the first paragraph, no main title), a summary, and keywords.',
    agent=stylist
)


# --- CREW DEFINITION ---

blog_crew = Crew(
  agents=[researcher, writer, stylist],
  tasks=[research_task, write_task, style_task],
  verbose=True,
  process=Process.sequential
)


# --- MAIN GENERATOR CLASS ---

class BlogGenerator:
    def __init__(self):
        print("✅ CrewAI Multi-Agent System Initialized")

    def generate_blog(self, topic, tone="professional"):
        """Generates a blog post using a multi-agent crew."""
        try:
            print(f"🤖 CrewAI starting job for topic: {topic}")
            result = blog_crew.kickoff(inputs={'topic': topic})
            
            # The raw output should be a string containing the JSON
            raw_output = result.raw if hasattr(result, 'raw') else str(result)
            
            # Clean the string to remove markdown fences around the JSON
            clean_json_str = re.sub(r'```json\n|\n```', '', raw_output, flags=re.MULTILINE).strip()
            
            return json.loads(clean_json_str)

        except Exception as e:
            print(f"🚨 CrewAI Error: {str(e)}")
            return {
                "blogContent": f"## An Error Occurred\n\nCould not generate the blog post using the agent crew.\n\n**Error Details:**\n`{str(e)}`",
                "summary": "Error generating content.",
                "keywords": ["error"]
            }

if __name__ == '__main__':
    generator = BlogGenerator()
    content = generator.generate_blog(topic="The Future of Artificial Intelligence")
    print("\n\n--- FINAL OUTPUT ---")
    print(json.dumps(content, indent=2))