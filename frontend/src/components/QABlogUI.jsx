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

  const startInterview = async () => {
    if (!topic.trim()) return alert("Please enter a topic!");
    setConversation([]);
    setBlogResult(null);
    setIsReadyToWrite(false);

    setLoading(true);
    const res = await axios.post("http://localhost:5000/interview", {
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
    const res = await axios.post("http://localhost:5000/interview", {
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
      const res = await axios.post("http://localhost:5000/generate");
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
      const res = await axios.post("http://localhost:5000/quick-generate", {
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

  // Format blog content for better display
  const formatBlogContent = (content) => {
    return content
      // Remove extra asterisks and clean markdown
      .replace(/\*{3,}/g, '') // Remove triple or more asterisks
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>') // Bold+italic
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #2c3e50; font-weight: 600;">$1</strong>') // Bold
      .replace(/\*([^*]+)\*/g, '<em style="color: #5d6d7e;">$1</em>') // Italic
      
      // Handle headings with better styling
      .replace(/^# (.+)$/gm, '<h1 style="color: #2c3e50; font-size: 32px; font-weight: bold; margin: 30px 0 20px 0; line-height: 1.2; border-bottom: 3px solid #3498db; padding-bottom: 12px; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 style="color: #34495e; font-size: 24px; font-weight: 600; margin: 25px 0 15px 0; line-height: 1.3; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="color: #5d6d7e; font-size: 20px; font-weight: 500; margin: 20px 0 12px 0; line-height: 1.4; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;">$1</h3>')
      
      // Handle tables better
      .replace(/\|(.+)\|/g, (match, content) => {
        const cells = content.split('|').map(cell => cell.trim());
        const cellsHtml = cells.map(cell => `<td style="padding: 12px; border: 1px solid #ddd; background: #f8f9fa;">${cell}</td>`).join('');
        return `<tr>${cellsHtml}</tr>`;
      })
      .replace(/(<tr>.*<\/tr>)/gs, '<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">$1</table>')
      
      // Handle lists better
      .replace(/^[-*+] (.+)$/gm, '<li style="margin: 8px 0; line-height: 1.6; padding-left: 5px;">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li style="margin: 8px 0; line-height: 1.6; padding-left: 5px;">$2</li>')
      
      // Group consecutive list items
      .replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, (match) => {
        return `<ul style="margin: 15px 0; padding-left: 25px; list-style-type: disc;">${match}</ul>`;
      })
      
      // Handle paragraphs - split by double line breaks
      .split(/\n\s*\n/)
      .map(para => {
        para = para.trim();
        if (!para) return '';
        // Don't wrap headings, lists, or tables in p tags
        if (para.match(/^<(h[1-6]|ul|ol|table|li)/)) {
          return para;
        }
        return `<p style="margin: 16px 0; line-height: 1.7; color: #2c3e50; text-align: justify;">${para.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('');
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
    <div style={{ maxWidth: "800px", margin: "auto", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center", color: "#333", marginBottom: "30px" }}>
        📝 AI Blog Generator
      </h2>

      {!conversation.length && !blogResult && (
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "10px", marginBottom: "20px" }}>
          <h3 style={{ marginTop: "0", color: "#495057" }}>Enter Your Blog Topic</h3>
          <input
            type="text"
            placeholder="Enter blog topic (e.g., Artificial Intelligence, Healthy Living, etc.)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "12px", 
              marginBottom: "15px", 
              border: "2px solid #dee2e6",
              borderRadius: "5px",
              fontSize: "16px"
            }}
          />
          
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={startInterview} 
              disabled={loading}
              style={{
                flex: "1",
                padding: "12px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                fontSize: "16px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? "Loading..." : "📝 Get Overview & Customize"}
            </button>
            
            <button 
              onClick={quickGenerate} 
              disabled={loading}
              style={{
                flex: "1",
                padding: "12px 20px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "5px",
                fontSize: "16px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? "Generating..." : "⚡ Quick Generate"}
            </button>
          </div>
          
          <p style={{ marginTop: "15px", fontSize: "14px", color: "#6c757d", textAlign: "center" }}>
            <strong>Overview & Customize:</strong> See what will be covered, then add your specific requirements<br/>
            <strong>Quick Generate:</strong> Instantly create a comprehensive blog post
          </p>
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
              background: "#ffffff", 
              padding: "40px", 
              borderRadius: "15px", 
              border: "1px solid #e0e6ed",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
              fontFamily: "'Georgia', 'Times New Roman', serif",
              maxWidth: "100%",
              overflow: "hidden",
              position: "relative"
            }}
          >
            <div style={{
              position: "absolute",
              top: "0",
              left: "0",
              right: "0",
              height: "5px",
              background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "15px 15px 0 0"
            }}></div>
            
            <div 
              style={{ 
                fontSize: "16px",
                lineHeight: "1.8",
                color: "#2c3e50",
                textAlign: "justify",
                marginTop: "20px"
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
