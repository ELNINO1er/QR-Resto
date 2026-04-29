import React from 'react';
import { colors } from '../lib/colors';

export function isPhotoImage(value) {
  return typeof value === 'string' && (
    value.startsWith('data:image/') ||
    value.startsWith('/uploads/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}

export default function DishImage({ value, className = '', emojiClassName = 'text-5xl', rounded = 'rounded-lg' }) {
  if (isPhotoImage(value)) {
    return (
      <img
        src={value}
        alt=""
        className={`w-full h-full object-cover ${rounded} ${className}`}
      />
    );
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${emojiClassName} ${rounded} ${className}`}
      style={{ background: colors.sand }}
    >
      {value || '🍽️'}
    </div>
  );
}
