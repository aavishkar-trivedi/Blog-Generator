"""
Test script for the robust YouTube blog generator
This demonstrates how the function handles various scenarios
"""

import json
import os
from youtube_blog_generator import generate_blog_from_youtube

def test_youtube_blog_generator():
    """Test the robust YouTube blog generator with different scenarios"""
    
    print("🧪 Testing Robust YouTube Blog Generator\n")
    
    # Test URLs (you can replace these with actual URLs)
    test_cases = [
        {
            "name": "Valid YouTube URL with transcript",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # Rick Roll - famous video
            "context": "Focus on the cultural impact"
        },
        {
            "name": "Invalid URL",
            "url": "not-a-youtube-url",
            "context": ""
        },
        {
            "name": "Empty URL",
            "url": "",
            "context": ""
        }
    ]
    
    # You would need to provide your actual API keys
    api_keys = {
        "gemini_api_key": os.getenv("GEMINI_API_KEY", "your_gemini_api_key_here"),
        "google_search_api_key": "AIzaSyBulaFMZql3n6-mtJnHF55371CYtJu_9R8",  # Your existing key
        "search_engine_id": "a65b8e8b1cf564e44"  # Your existing search engine
    }
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"{'='*60}")
        print(f"Test {i}: {test_case['name']}")
        print(f"URL: {test_case['url']}")
        print(f"{'='*60}")
        
        try:
            result = generate_blog_from_youtube(
                video_url=test_case['url'],
                additional_context=test_case['context'],
                **api_keys
            )
            
            print(f"✅ Function executed successfully")
            print(f"🎯 Success: {result['success']}")
            
            if result['success']:
                print(f"📝 Blog generated: {len(result['blog_content'])} characters")
                print(f"🎥 Video: {result['video_info']['title']}")
                print(f"👤 Author: {result['video_info']['author']}")
                print(f"⚙️ Method: {result['generation_info']['method']}")
                print(f"📄 Transcript: {result['generation_info']['transcript_available']}")
            else:
                print(f"❌ Error: {result['error']}")
                print(f"📊 Video info available: {bool(result.get('video_info'))}")
            
            print(f"📅 Timestamp: {result['timestamp']}")
            
        except Exception as e:
            print(f"💥 Exception occurred: {e}")
        
        print("\n")
    
    print("🏁 Testing complete!")

def test_structured_response():
    """Test that the function always returns a properly structured response"""
    
    print("🔍 Testing Response Structure\n")
    
    # Test with minimal parameters
    result = generate_blog_from_youtube("")
    
    print("📋 Response Structure Test:")
    required_keys = ['success', 'error', 'blog_content', 'video_info', 'generation_info', 'timestamp']
    
    for key in required_keys:
        if key in result:
            print(f"✅ {key}: Present ({type(result[key]).__name__})")
        else:
            print(f"❌ {key}: Missing")
    
    print(f"\n🎯 Success field: {result['success']}")
    print(f"❌ Error field: {result['error']}")
    print(f"📝 Blog content: {result['blog_content']}")
    
    return result

if __name__ == "__main__":
    print("🚀 Starting YouTube Blog Generator Tests\n")
    
    # Test 1: Structure test
    test_structured_response()
    
    print("\n" + "="*80 + "\n")
    
    # Test 2: Full functionality test
    test_youtube_blog_generator()
    
    print("✨ All tests completed!")
