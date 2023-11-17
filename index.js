const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cache = require('memory-cache');

const app = express();
const port = 3000;
app.disable('x-powered-by');

const apiKey = "YOUR_API_KEY_HERE";

// CORS settings
const corsOptions = {
  origin: 'YOUR_DOMAIN_HERE',
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Middleware to log cache status and add custom header
const logCacheStatus = (req, res, next) => {
  const key = req.originalUrl;
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    res.setHeader('X-Proxy-Cache', 'HIT'); // Add custom header for cached response
    console.log(`[${new Date().toISOString()}] Returning from cache: ${key}`);
  } else {
    res.setHeader('X-Proxy-Cache', 'MISS'); // Add custom header for new API request
    console.log(`[${new Date().toISOString()}] Making API request for: ${key}`);
  }

  next();
};

// Middleware to cache responses
const cacheMiddleware = (req, res, next) => {
  const key = req.originalUrl;
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    // If cached response exists, send it
    res.json(cachedResponse);
  } else {
    // If not cached, proceed with the route handling
    next();
  }
};

app.get('/search', logCacheStatus, cacheMiddleware, async (req, res) => {
  // Check if the request is coming from https://popotin.cum
  const referer = req.get('Referer');
  if (referer && referer.includes('YOUR_DOMAIN_HERE')) {
    // Extract the query parameter from the request
    const query = req.query.q;

    // Construct the API URL with the provided query
    const apiUrl = `https://api.search.brave.com/res/v1/web/search?q=${query}`;

    try {
      // Make a request to the external API
      const response = await axios.get(apiUrl, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      });

      // Cache the response for 5 days (in milliseconds)
      cache.put(req.originalUrl, response.data, 5 * 86400000);

      // Send the response from the external API to the client
      res.json(response.data);
    } catch (error) {
      // Handle errors
      console.error('Error proxying request:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    // Request is not coming from https://resulti.net
    res.status(403).json({ error: 'Forbidden' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
