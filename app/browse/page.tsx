import Header from '@/components/Header';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/solid';

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
];

const BrowsePage = async () => {
  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pt-24">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Browse by Country
        </h1>
        <p className="text-gray-400 mb-8">
          Explore popular movies and TV shows from different countries
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COUNTRIES.map((country) => (
            <Link
              key={country.code}
              href={`/browse/country/${country.code.toLowerCase()}`}
              className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 p-6 hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-5xl mb-3">{country.flag}</div>
                  <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {country.name}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    View popular content
                  </p>
                </div>
                <ChevronRightIcon className="h-6 w-6 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default BrowsePage;
