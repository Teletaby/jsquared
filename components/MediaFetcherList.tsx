import MediaCard from './MediaCard';

interface MediaFetcherListProps {
  title: string;
  items: any[];
}

const MediaFetcherList = ({ title, items }: MediaFetcherListProps) => {
  return (
    <div className="my-8">
      <h2 className="text-3xl mb-4 text-white">{title}</h2>
      {items && items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((item: any) => (
            <MediaCard 
              key={item.id} 
              media={{ ...item, media_type: item.media_type }} 
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 bg-ui-elements p-8 rounded-lg">
          <h3 className="text-xl mb-2">Could Not Load Content</h3>
          <p>This might be because the TMDB API key is not set up correctly or no movies were found for this category.</p>
        </div>
      )}
    </div>
  );
};

export default MediaFetcherList;