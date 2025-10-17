exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { type, query } = JSON.parse(event.body);
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const MODEL = 'llama-3.3-70b-versatile';

    if (!GROQ_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    let prompt, temperature, maxTokens;

    switch (type) {
      case 'safety':
        prompt = `Analyze if this search query contains 18+ or inappropriate content. Respond with ONLY a JSON object in this exact format: {"safe": true} or {"safe": false}. No other text. Query: "${query}"`;
        temperature = 0.1;
        maxTokens = 50;
        break;

      case 'answer':
        prompt = `Answer this search query concisely. Respond in ONLY valid JSON format with this exact structure: {"direct_answer": "brief answer here", "explanation": "detailed explanation here"}. No other text before or after the JSON. Query: "${query}"`;
        temperature = 0.3;
        maxTokens = 500;
        break;

      case 'related':
        prompt = `Generate 5 related search queries for: "${query}". Respond ONLY with a JSON array of strings, nothing else: ["search1", "search2", "search3", "search4", "search5"]`;
        temperature = 0.7;
        maxTokens = 200;
        break;

      case 'facts':
        prompt = `If this query is about a specific topic, provide 3-5 quick facts as key-value pairs. Respond ONLY with JSON: {"title": "Topic Name", "facts": [{"label": "Fact Label", "value": "Fact Value"}]}. If not applicable, respond with: {"applicable": false}. Query: "${query}"`;
        temperature = 0.3;
        maxTokens = 400;
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid request type' })
        };
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'AI service error' })
      };
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Invalid AI response' })
      };
    }

    const content = data.choices[0].message.content.trim();
    
    // Extract JSON from response
    let result;
    if (type === 'related') {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        result = { suggestions: JSON.parse(jsonMatch[0]) };
      }
    } else {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result || { error: 'Could not parse AI response' })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};