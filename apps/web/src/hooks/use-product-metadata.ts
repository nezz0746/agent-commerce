"use client";

import { useEffect, useState } from "react";

export interface ProductMetadata {
  name: string;
  description: string;
  image: string;
}

export function useProductMetadata(metadataURI: string | undefined) {
  const [metadata, setMetadata] = useState<ProductMetadata | null>(null);

  useEffect(() => {
    if (!metadataURI) return;
    fetch(metadataURI)
      .then((r) => r.json())
      .then(setMetadata)
      .catch(() => {});
  }, [metadataURI]);

  return metadata;
}
