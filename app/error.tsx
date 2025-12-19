"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log to console so dev overlay shows the error
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{padding:40,fontFamily:'Inter, system-ui, sans-serif'}}>
          <h1 style={{margin:0}}>Something went wrong</h1>
          <p style={{color:'#7a7a7a'}}>{error?.message ?? 'An unexpected error occurred.'}</p>
          <button onClick={() => reset()} style={{marginTop:12,padding:'8px 12px'}}>Try again</button>
        </div>
      </body>
    </html>
  );
}
