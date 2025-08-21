"""
Integration example for the robust YouTube blog generator
This shows how to integrate the robust function into your existing Flask app
"""

from flask import Flask, request, jsonify
from youtube_blog_generator import generate_blog_from_youtube
import os

app = Flask(__name__)

# Configuration - replace with your actual API keys
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'your_gemini_api_key_here')
GOOGLE_SEARCH_API_KEY = os.getenv('GOOGLE_SEARCH_API_KEY', 'your_google_search_api_key_here')
SEARCH_ENGINE_ID = os.getenv('SEARCH_ENGINE_ID', 'your_search_engine_id_here')

@app.route("/youtube-generate", methods=["POST"])
def youtube_generate_endpoint():
    """
    Robust YouTube blog generation endpoint
    Handles all edge cases and always returns a proper response
    """
    try:
        # Get request data
        data = request.json if request.json else {}
        youtube_url = data.get("youtubeUrl", "").strip()
        additional_context = data.get("additionalContext", "").strip()
        
        # Validate input
        if not youtube_url:
            return jsonify({
                "success": False,
                "error": "YouTube URL is required",
                "blog_content": None
            }), 400
        
        print(f"🎥 Processing YouTube video: {youtube_url}")
        
        # Call the robust blog generation function
        result = generate_blog_from_youtube(
            video_url=youtube_url,
            additional_context=additional_context,
            gemini_api_key=GEMINI_API_KEY,
            google_search_api_key=GOOGLE_SEARCH_API_KEY,
            search_engine_id=SEARCH_ENGINE_ID
        )
        
        # Check if generation was successful
        if result['success']:
            # Success case
            response_data = {
                "success": True,
                "blogContent": result['blog_content'],
                "summary": f"Blog generated from YouTube video: '{result['video_info']['title']}' by {result['video_info']['author']}",
                "keywords": [],  # You can extract keywords from metadata if needed
                "source": {
                    "type": "YouTube Video",
                    "title": result['video_info']['title'],
                    "author": result['video_info']['author'],
                    "url": youtube_url,
                    "duration": f"{result['video_info']['duration_minutes']} minutes",
                    "views": result['video_info']['views'],
                    "transcript_available": result['generation_info']['transcript_available'],
                    "generation_method": result['generation_info']['method']
                },
                "metadata": {
                    "generated_at": result['timestamp'],
                    "method": result['generation_info']['method'],
                    "research_sources": result['generation_info'].get('research_sources', 0)
                }
            }
            
            print(f"✅ Blog generated successfully using {result['generation_info']['method']}")
            return jsonify(response_data), 200
            
        else:
            # Error case - but still return structured response
            error_response = {
                "success": False,
                "error": result['error'],
                "blog_content": None,
                "video_info": result.get('video_info', {}),
                "timestamp": result['timestamp']
            }
            
            print(f"❌ Blog generation failed: {result['error']}")
            return jsonify(error_response), 400
    
    except Exception as e:
        # Ultimate fallback for any unexpected errors
        print(f"❌ Unexpected error in endpoint: {e}")
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}",
            "blog_content": None
        }), 500

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "YouTube Blog Generator",
        "version": "1.0.0"
    }), 200

if __name__ == "__main__":
    print("🚀 Starting YouTube Blog Generator Server")
    print(f"✅ Gemini API configured: {'Yes' if GEMINI_API_KEY != 'your_gemini_api_key_here' else 'No'}")
    print(f"✅ Google Search API configured: {'Yes' if GOOGLE_SEARCH_API_KEY != 'your_google_search_api_key_here' else 'No'}")
    
    app.run(debug=True, host='0.0.0.0', port=3001)
