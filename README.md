# J-Squared Cinema

This is a movie website project created by Gemini.

## Getting Started

To get the development server running, you need to follow these steps.

### 1. Install Dependencies

First, you need to install all the required packages defined in `package.json`.

Open your terminal, make sure you are in the `j-squared-cinema` directory, and run the following command:

```bash
npm install
```

### 2. Run the Development Server

Once the installation is complete, you can start the development server:

```bash
npm run dev
```

### 3. Set Up Your API Key

This project uses The Movie Database (TMDB) API to fetch movie and TV show data. You will need your own API key to run the application.

1.  **Get a TMDB API Key:**
    *   Create an account on [themoviedb.org](https://www.themoviedb.org/).
    *   Go to your account settings, find the "API" section, and request an API key.
2.  **Create a local environment file:**
    *   In the root of the `j-squared-cinema` directory, create a file named `.env.local`.
3.  **Add the key to the file:**
    *   Open `.env.local` and add your API key like this:
        ```
        TMDB_API_KEY=your_actual_api_key_here
        ```

Once you've added the key and restarted the development server, you should see movie and TV show posters on the homepage.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Next Steps

The project is now set up. The next steps will be to build out the features and the cinema theme.
