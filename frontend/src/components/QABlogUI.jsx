import React, { useState, useRef } from "react";
import axios from "axios";
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

export default function QABlogUI() {
  const [topic, setTopic] = useState("");
  const [conversation, setConversation] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [blogResult, setBlogResult] = useState(null);
  const [isReadyToWrite, setIsReadyToWrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const blogContentRef = useRef(null);

  // Add CSS for animations
  React.useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const startInterview = async () => {
    if (!topic.trim()) return alert("Please enter a topic!");
    setConversation([]);
    setBlogResult(null);
    setIsReadyToWrite(false);

    setLoading(true);
    const res = await axios.post("http://localhost:3001/interview", {
      topic,
      answer: ""
    });
    setConversation([{ role: "agent", content: res.data.question }]);
    setIsReadyToWrite(true); // Since we show overview instead of questions
    setLoading(false);
  };

  const sendAnswer = async () => {
    if (!userInput.trim()) return;

    const updatedConversation = [
      ...conversation,
      { role: "user", content: userInput }
    ];
    setConversation(updatedConversation);
    setUserInput("");

    setLoading(true);
    const res = await axios.post("http://localhost:3001/interview", {
      topic,
      answer: userInput
    });

    const agentReply = res.data.question;
    updatedConversation.push({ role: "agent", content: agentReply });
    setConversation([...updatedConversation]);
    setLoading(false);
    setIsReadyToWrite(true);
  };

  const generateBlog = async () => {
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:3001/generate");
      setBlogResult(res.data);
    } catch (error) {
      alert("Error generating blog. Please try again.");
    }
    setLoading(false);
  };

  const quickGenerate = async () => {
    if (!topic.trim()) return alert("Please enter a topic!");
    
    setLoading(true);
    setBlogResult(null);
    setConversation([]);
    
    try {
      const res = await axios.post("http://localhost:3001/quick-generate", {
        topic: topic
      });
      setBlogResult(res.data);
    } catch (error) {
      alert("Error generating blog. Please try again.");
    }
    setLoading(false);
  };

  const resetAll = () => {
    setTopic("");
    setConversation([]);
    setUserInput("");
    setBlogResult(null);
    setIsReadyToWrite(false);
  };

  // Format blog content in simple, clean blog format like real-world blogs
  const formatBlogContent = (content) => {
    if (!content) return '';
    
    // Step 1: Clean up the content and handle \n properly
    let cleanContent = content
      .replace(/\\n/g, '\n') // Convert escaped \n to actual newlines
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
      .replace(/#{1,6}\s*/g, '') // Remove markdown # symbols
      .replace(/\*{2,}/g, '') // Remove ** and ***
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // Remove code blocks
      .replace(/```[^`]*```/g, '') // Remove code fences
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .trim();

    // Step 2: Split into sections based on double line breaks
    const sections = cleanContent.split(/\n\s*\n/).filter(section => section.trim());
    
    let formattedHTML = '';
    let titleFound = false;
    
    sections.forEach((section, index) => {
      section = section.trim();
      if (!section) return;
      
      // Step 3: Detect content type with better logic
      const words = section.split(' ').length;
      const endsWithPeriod = section.endsWith('.');
      const isShortLine = words <= 15;
      const isVeryShortLine = words <= 8;
      const startsWithNumber = /^\d+\./.test(section);
      const startsWithBullet = /^[-•*]/.test(section);
      const isQuestionOrTitle = section.includes('?') || (!titleFound && isVeryShortLine && !endsWithPeriod);
      
      // Determine content type
      if (!titleFound && (isQuestionOrTitle || (index === 0 && isShortLine))) {
        // Main blog title
        titleFound = true;
        formattedHTML += `
          <h1 style="
            font-size: 32px;
            font-weight: 700;
            margin: 30px 0 25px 0;
            text-align: center;
            color: #1a202c;
            border-bottom: 3px solid #667eea;
            padding-bottom: 15px;
            font-family: 'Georgia', serif;
            line-height: 1.3;
          ">${highlightImportantWords(section)}</h1>
        `;
      } else if (isShortLine && !endsWithPeriod && !startsWithBullet && !startsWithNumber) {
        // Section heading
        formattedHTML += `
          <h2 style="
            font-size: 24px;
            font-weight: 600;
            margin: 30px 0 15px 0;
            color: #2d3748;
            border-left: 5px solid #667eea;
            padding-left: 20px;
            font-family: 'Georgia', serif;
            line-height: 1.4;
            background: linear-gradient(90deg, #f7fafc 0%, transparent 100%);
            padding-top: 10px;
            padding-bottom: 10px;
          ">${highlightImportantWords(section)}</h2>
        `;
      } else if (startsWithBullet || startsWithNumber || section.includes('\n•') || section.includes('\n-')) {
        // Handle lists (bullet points or numbered)
        const lines = section.split('\n').filter(line => line.trim());
        formattedHTML += '<ul style="margin: 20px 0; padding-left: 0; list-style: none;">';
        
        lines.forEach(line => {
          line = line.trim();
          if (line && (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))) {
            // Remove bullet/number prefix
            const cleanLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
            formattedHTML += `
              <li style="
                margin: 12px 0;
                padding: 12px 0 12px 25px;
                position: relative;
                line-height: 1.6;
                font-size: 16px;
                font-family: 'Georgia', serif;
                border-left: 2px solid #e2e8f0;
                padding-left: 20px;
              ">
                <span style="
                  position: absolute;
                  left: -8px;
                  top: 12px;
                  width: 8px;
                  height: 8px;
                  background: #667eea;
                  border-radius: 50%;
                "></span>
                ${highlightImportantWords(cleanLine)}
              </li>
            `;
          } else if (line) {
            // Regular line within a list context
            formattedHTML += `
              <li style="
                margin: 8px 0;
                padding-left: 20px;
                line-height: 1.6;
                font-size: 16px;
                font-family: 'Georgia', serif;
              ">${highlightImportantWords(line)}</li>
            `;
          }
        });
        formattedHTML += '</ul>';
      } else {
        // Regular paragraph - handle multi-line content properly
        const lines = section.split('\n').filter(line => line.trim());
        const paragraphContent = lines.join(' '); // Join lines with spaces
        
        formattedHTML += `
          <p style="
            margin: 20px 0;
            line-height: 1.8;
            font-size: 16px;
            text-align: justify;
            font-family: 'Georgia', serif;
            color: #2d3748;
            text-indent: 30px;
            background: #fafbfc;
            padding: 15px 20px;
            border-radius: 8px;
            border-left: 3px solid #e2e8f0;
          ">${highlightImportantWords(paragraphContent)}</p>
        `;
      }
    });
    
    // Add some final styling
    return `<div style="max-width: 800px; margin: 0 auto; padding: 20px;">${formattedHTML}</div>`;
  };

  // Simple function to make important words bold
  const highlightImportantWords = (text) => {
    if (!text) return '';
    
    // Clean important word patterns - only the most essential ones
    const patterns = [
      // Technical terms
      /\b(artificial intelligence|AI|machine learning|ML|deep learning|neural networks|blockchain|cryptocurrency|cybersecurity|automation|robotics|quantum computing|data science|big data|IoT|5G|cloud computing)\b/gi,
      
      // Key business terms
      /\b(research|study|analysis|innovation|development|strategy|solution|technology|performance|efficiency|results|findings|conclusion)\b/gi,
      
      // Numbers and statistics
      /\b\d+%|\b\d{4}|\$[\d,]+|\b\d+(?:,\d{3})*\b/g,
      
      // Important emphasis words
      /\b(important|significant|critical|essential|major|key|primary|fundamental|crucial|advanced|comprehensive)\b/gi
    ];
    
    let result = text;
    
    // Apply simple bold formatting
    patterns.forEach(pattern => {
      result = result.replace(pattern, '<strong>$&</strong>');
    });
    
    return result;
  };

  // Download as PDF with better formatting
  const downloadPDF = () => {
    if (!blogResult || !blogResult.blogContent) return;
    
    // Create a new jsPDF instance
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;
    
    // Helper function to add text with word wrapping
    const addText = (text, fontSize, fontStyle = 'normal', color = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setFont(undefined, fontStyle);
      doc.setTextColor(...color);
      
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      
      lines.forEach(line => {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += fontSize * 0.5;
      });
      
      yPosition += 3; // Add some spacing after text
    };
    
    // Clean content for PDF (remove HTML and markdown)
    const cleanContent = blogResult.blogContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*{1,}/g, '') // Remove asterisks
      .replace(/#{1,}/g, '') // Remove hash symbols
      .trim();
    
    // Split content into sections
    const sections = cleanContent.split(/\n\s*\n/);
    
    sections.forEach(section => {
      section = section.trim();
      if (!section) return;
      
      // Check if it's a heading (starts with original heading text pattern)
      if (section.length < 100 && !section.includes('.') && !section.includes(',')) {
        // Likely a heading
        addText(section, 16, 'bold', [44, 62, 80]);
        yPosition += 3;
      } else {
        // Regular content
        addText(section, 11, 'normal', [44, 62, 80]);
        yPosition += 5;
      }
    });
    
    // Add summary at the end
    if (blogResult.summary) {
      yPosition += 10;
      addText('Summary', 14, 'bold', [52, 152, 219]);
      addText(blogResult.summary, 10, 'normal', [127, 140, 141]);
    }
    
    // Add keywords
    if (blogResult.keywords && blogResult.keywords.length > 0) {
      yPosition += 10;
      addText('Keywords', 14, 'bold', [52, 152, 219]);
      addText(blogResult.keywords.join(', '), 10, 'normal', [127, 140, 141]);
    }
    
    doc.save(`${topic.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  // Download as Markdown
  const downloadMarkdown = () => {
    if (!blogResult || !blogResult.blogContent) return;
    
    const markdownContent = `# ${topic}\n\n${blogResult.blogContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*{2,}/g, '') // Remove extra asterisks
    }\n\n## Summary\n${blogResult.summary}\n\n## Keywords\n${blogResult.keywords.join(', ')}`;
    
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `blog-${topic.replace(/\s+/g, '-').toLowerCase()}.md`);
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    if (!blogResult || !blogResult.blogContent) return;
    
    const plainText = blogResult.blogContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*{1,}/g, ''); // Remove asterisks
      
    navigator.clipboard.writeText(plainText).then(() => {
      alert('Blog content copied to clipboard!');
    });
  };

  return (
    <div style={{ 
      maxWidth: "900px", 
      margin: "auto", 
      padding: "20px", 
      fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      backgroundColor: "#f8fafc",
      minHeight: "100vh"
    }}>
      <div style={{
        textAlign: "center",
        marginBottom: "40px",
        padding: "30px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "20px",
        color: "white",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      }}>
        <h1 style={{ 
          fontSize: "32px", 
          fontWeight: "700", 
          margin: "0",
          textShadow: "0 2px 4px rgba(0,0,0,0.3)"
        }}>
          ✨ AI Blog Generator
        </h1>
        <p style={{ 
          fontSize: "16px", 
          margin: "10px 0 0 0", 
          opacity: "0.9"
        }}>
          Create professional, research-backed blog posts instantly
        </p>
      </div>

      {!conversation.length && !blogResult && (
        <div style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "15px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          border: "1px solid #e1e8ed",
          marginBottom: "30px"
        }}>
          <h3 style={{ 
            fontSize: "18px", 
            fontWeight: "600", 
            color: "#1a202c", 
            marginTop: "0",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span>💡</span> What would you like to write about?
          </h3>
          <input
            type="text"
            placeholder="Enter your blog topic (e.g., Artificial Intelligence, Healthy Living, etc.)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "15px", 
              marginBottom: "20px", 
              border: "2px solid #e2e8f0",
              borderRadius: "10px",
              fontSize: "16px",
              fontFamily: "inherit",
              outline: "none",
              transition: "border-color 0.2s ease",
              backgroundColor: "#fafbfc"
            }}
            onFocus={(e) => e.target.style.borderColor = "#667eea"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
          
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            <button 
              onClick={startInterview} 
              disabled={loading || !topic.trim()}
              style={{
                flex: "1",
                minWidth: "200px",
                padding: "15px 20px",
                background: topic.trim() && !loading 
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                  : "#94a3b8",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: topic.trim() && !loading ? "pointer" : "not-allowed",
                transition: "all 0.3s ease",
                boxShadow: topic.trim() && !loading 
                  ? "0 4px 15px rgba(102, 126, 234, 0.4)" 
                  : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
              onMouseOver={(e) => {
                if (topic.trim() && !loading) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
                }
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = topic.trim() && !loading 
                  ? "0 4px 15px rgba(102, 126, 234, 0.4)" 
                  : "none";
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: "18px",
                    height: "18px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}></div>
                  Loading...
                </>
              ) : (
                <>
                  <span>📝</span>
                  Get Overview & Customize
                </>
              )}
            </button>
            
            <button 
              onClick={quickGenerate} 
              disabled={loading || !topic.trim()}
              style={{
                flex: "1",
                minWidth: "200px",
                padding: "15px 20px",
                background: topic.trim() && !loading 
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
                  : "#94a3b8",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: topic.trim() && !loading ? "pointer" : "not-allowed",
                transition: "all 0.3s ease",
                boxShadow: topic.trim() && !loading 
                  ? "0 4px 15px rgba(16, 185, 129, 0.4)" 
                  : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
              onMouseOver={(e) => {
                if (topic.trim() && !loading) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.6)";
                }
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = topic.trim() && !loading 
                  ? "0 4px 15px rgba(16, 185, 129, 0.4)" 
                  : "none";
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: "18px",
                    height: "18px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}></div>
                  Generating...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Quick Generate
                </>
              )}
            </button>
          </div>
          
          <div style={{ 
            marginTop: "20px", 
            padding: "15px", 
            backgroundColor: "#f8fafc", 
            borderRadius: "8px",
            border: "1px solid #e2e8f0"
          }}>
            <p style={{ 
              margin: "0", 
              fontSize: "14px", 
              color: "#64748b", 
              textAlign: "center",
              lineHeight: "1.5"
            }}>
              <span style={{ fontWeight: "600", color: "#475569" }}>📝 Overview & Customize:</span> See what will be covered, then add your specific requirements<br/>
              <span style={{ fontWeight: "600", color: "#475569" }}>⚡ Quick Generate:</span> Instantly create a comprehensive blog post
            </p>
          </div>
        </div>
      )}

      {!conversation.length && !blogResult && (
        <div style={{ display: 'none' }}>
          {/* Google Custom Search widget removed from UI as requested */}
        </div>
      )}

      {conversation.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ 
            color: "#2c3e50", 
            fontSize: "24px", 
            fontWeight: "600", 
            marginBottom: "20px",
            textAlign: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            📋 Blog Content Overview
          </h3>
          
          {conversation.map((msg, idx) => (
            <div 
              key={idx} 
              style={{ 
                background: msg.role === "agent" 
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                  : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", 
                padding: "25px", 
                borderRadius: "15px",
                marginBottom: "15px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                color: "white",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div style={{
                position: "absolute",
                top: "0",
                left: "0",
                right: "0",
                bottom: "0",
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(10px)",
                borderRadius: "15px",
                zIndex: "1"
              }}></div>
              
              <div style={{ position: "relative", zIndex: "2" }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  marginBottom: "15px",
                  fontSize: "16px",
                  fontWeight: "600"
                }}>
                  <span style={{ 
                    background: "rgba(255,255,255,0.2)", 
                    padding: "8px 15px", 
                    borderRadius: "25px",
                    marginRight: "10px",
                    fontSize: "14px"
                  }}>
                    {msg.role === "agent" ? "🤖 AI Content Planner" : "👤 Your Requirements"}
                  </span>
                </div>
                
                <div 
                  style={{ 
                    lineHeight: "1.8", 
                    fontSize: "15px",
                    background: "rgba(255,255,255,0.1)",
                    padding: "20px",
                    borderRadius: "10px",
                    backdropFilter: "blur(5px)"
                  }}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.+?)\*\*/g, '<span style="font-weight: bold; color: #ffd700;">$1</span>')
                      .replace(/\*(.+?)\*/g, '<span style="font-style: italic; color: #e8f4fd;">$1</span>')
                      .replace(/^(\*\s.+$)/gm, '<li style="margin: 8px 0; padding-left: 10px;">$1</li>')
                      .replace(/(<li.*?>.*?<\/li>)/gs, '<ul style="margin: 10px 0; padding-left: 20px; list-style: none;">$1</ul>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              </div>
            </div>
          ))}

          {isReadyToWrite && (
            <div style={{ 
              marginTop: "25px", 
              background: "linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)", 
              padding: "25px", 
              borderRadius: "15px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{
                position: "absolute",
                top: "0",
                left: "0",
                right: "0",
                bottom: "0",
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                borderRadius: "15px"
              }}></div>
              
              <div style={{ position: "relative", zIndex: "2" }}>
                <h4 style={{ 
                  margin: "0 0 15px 0", 
                  color: "#2c3e50",
                  fontSize: "18px",
                  fontWeight: "600",
                  textAlign: "center"
                }}>
                  ✨ Customize Your Content (Optional)
                </h4>
                
                <textarea
                  placeholder="Add specific examples, focus areas, or any particular angle you want covered..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  style={{ 
                    width: "100%", 
                    padding: "15px", 
                    marginBottom: "15px",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    minHeight: "80px",
                    resize: "vertical",
                    background: "rgba(255,255,255,0.9)",
                    boxShadow: "inset 0 2px 5px rgba(0,0,0,0.1)"
                  }}
                />
                
                <div style={{ display: "flex", gap: "12px" }}>
                  <button 
                    onClick={sendAnswer} 
                    disabled={loading}
                    style={{
                      padding: "12px 20px",
                      background: "linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "10px",
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      opacity: loading ? 0.7 : 1,
                      boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                    }}
                  >
                    {loading ? "Adding..." : "➕ Add Requirements"}
                  </button>
                  
                  <button 
                    onClick={generateBlog} 
                    disabled={loading}
                    style={{
                      flex: "1",
                      padding: "12px 20px",
                      background: "linear-gradient(135deg, #00b894 0%, #00a085 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "10px",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                      fontSize: "16px",
                      fontWeight: "600",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                    }}
                  >
                    {loading ? "🔄 Generating..." : "🚀 Generate Detailed Blog"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {blogResult && (
        <div style={{ marginTop: "30px" }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "25px",
            padding: "20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "15px",
            color: "white",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ 
              margin: "0", 
              fontSize: "24px", 
              fontWeight: "600",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)"
            }}>
              📄 Your Expert Blog Post
            </h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={copyToClipboard}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  backdropFilter: "blur(10px)"
                }}
              >
                📋 Copy Text
              </button>
              <button 
                onClick={downloadMarkdown}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  backdropFilter: "blur(10px)"
                }}
              >
                📄 Markdown
              </button>
              <button 
                onClick={downloadPDF}
                style={{
                  padding: "10px 16px",
                  background: "rgba(220,53,69,0.9)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  boxShadow: "0 4px 15px rgba(220,53,69,0.3)"
                }}
              >
                📑 Download PDF
              </button>
              <button 
                onClick={resetAll}
                style={{
                  padding: "10px 16px",
                  background: "rgba(108,117,125,0.9)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                ✨ New Blog
              </button>
            </div>
          </div>
          
          <div 
            ref={blogContentRef}
            style={{ 
              background: "white", 
              padding: "40px", 
              borderRadius: "10px", 
              border: "1px solid #ddd",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              fontFamily: "Georgia, serif",
              maxWidth: "100%",
              marginBottom: "30px"
            }}
          >
            <div 
              style={{ 
                fontSize: "16px",
                lineHeight: "1.7"
              }}
              dangerouslySetInnerHTML={{ 
                __html: formatBlogContent(blogResult.blogContent)
              }} 
            />
          </div>
          
          <div style={{ marginTop: "20px", display: "flex", gap: "20px" }}>
            <div style={{ flex: "1", background: "#f8f9fa", padding: "15px", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>🔍 Summary</h4>
              <p style={{ margin: "0", lineHeight: "1.5" }}>{blogResult.summary}</p>
            </div>
            
            <div style={{ flex: "1", background: "#f8f9fa", padding: "15px", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>🏷 Keywords</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {blogResult.keywords.map((keyword, idx) => (
                  <span 
                    key={idx}
                    style={{
                      background: "#007bff",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px"
                    }}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}