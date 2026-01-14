const { getTrendingMovies } = require('./lib/tmdb.ts');

async function test() {
  const data = await getTrendingMovies('1');
  if (data?.results?.[0]) {
    console.log('Keys:', Object.keys(data.results[0]));
    console.log('Production countries:', data.results[0].production_countries);
  }
}

test();