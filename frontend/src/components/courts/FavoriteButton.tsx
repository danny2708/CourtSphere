import { Heart } from "lucide-react";

import { Button } from "../common/Button";
import { cn } from "../../utils/cn";

type FavoriteButtonProps = {
  isFavorite?: boolean;
  onClick?: () => void;
};

export function FavoriteButton({ isFavorite = false, onClick }: FavoriteButtonProps) {
  return (
    <Button
      aria-label={isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
      className={cn("court-icon-button", isFavorite && "court-icon-button--active")}
      size="sm"
      variant="icon"
      onClick={onClick}
    >
      <Heart aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} size={18} />
    </Button>
  );
}
