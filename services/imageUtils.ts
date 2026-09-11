
export const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

export const applyFiltersToImage = (
  base64Str: string,
  brightness: number, // 0 to 200, default is 100
  contrast: number,   // 0 to 200, default is 100
  quality = 0.75
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64Str;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d') as any;
        if (ctx) {
          // If the browser supports canvas filters, apply them directly
          if (typeof ctx.filter !== 'undefined') {
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
          }
          ctx.drawImage(img, 0, 0, img.width, img.height);
        }
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        console.error("Erro ao aplicar filtros com canvas:", err);
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

