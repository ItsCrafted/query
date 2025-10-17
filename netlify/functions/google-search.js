exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { query, start = 1, num = 10, keyIndex = 0 } = JSON.parse(event.body);
    
    const GOOGLE_API_KEYS = [
      process.env.GOOGLE_API_KEY_1,
      process.env.GOOGLE_API_KEY_2,
      process.env.GOOGLE_API_KEY_3,
      process.env.GOOGLE_API_KEY_4,
      process.env.GOOGLE_API_KEY_5
    ].filter(key => key); // Remove undefined keys

    const GOOGLE_CX = process.env.GOOGLE_CX;

    if (GOOGLE_API_KEYS.length === 0 || !GOOGLE_CX) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Search credentials not configured' })
      };
    }

    if (keyIndex >= GOOGLE_API_KEYS.length) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'All API keys exhausted' })
      };
    }

    const apiKey = GOOGLE_API_KEYS[keyIndex];
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&start=${start}&num=${num}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      if (data.error.code === 429) {
        // Rate limit hit, suggest next key
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            error: 'Rate limit exceeded',
            nextKeyIndex: keyIndex + 1
          })
        };
      }
      return {
        statusCode: response.status || 500,
        body: JSON.stringify({ error: data.error.message })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: data.items || [],
        searchInformation: data.searchInformation
      })
    };

  } catch (error) {
    console.error('Search function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};