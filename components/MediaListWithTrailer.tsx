"use client";
import MediaFetcherList from './MediaFetcherList'; // Import the server component

interface MediaListWithTrailerProps {
  title: string;
  items: any[]; // The media items are now passed as a prop
}

const MediaListWithTrailer = ({ title, items }: MediaListWithTrailerProps) => {

  return (
    <>
      <MediaFetcherList title={title} items={items} />
    </>
  );
};

export default MediaListWithTrailer;
