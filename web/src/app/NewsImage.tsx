"use client";

import React, { useState } from "react";

interface NewsImageProps {
  src: string;
  alt: string;
}

export default function NewsImage({ src, alt }: NewsImageProps) {
  const [imgSrc, setImgSrc] = useState(src || "/coffee_hero2.jpg");

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={() => {
        if (imgSrc !== "/coffee_hero2.jpg") {
          setImgSrc("/coffee_hero2.jpg");
        }
      }}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-90"
    />
  );
}
