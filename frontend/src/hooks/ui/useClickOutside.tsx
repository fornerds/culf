import { RefObject, useEffect } from 'react';

function useClickOutside(
  ref: RefObject<HTMLElement>,
  onClickOutside?: (e: MouseEvent | TouchEvent) => void,
) {
  const isOutside = (e: MouseEvent | TouchEvent) => {
    return !!ref.current && !ref.current.contains(e.target as HTMLElement);
  };

  const onMouseDown = (e: MouseEvent | TouchEvent) => {
    if (isOutside(e) && onClickOutside) {
      onClickOutside(e);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('touchstart', onMouseDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('touchstart', onMouseDown);
    };
  }, [onClickOutside]);
}

export default useClickOutside;
