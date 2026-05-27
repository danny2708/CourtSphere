import { Share2 } from "lucide-react";

import { Button } from "../common/Button";

type ShareButtonProps = {
  onClick?: () => void;
};

export function ShareButton({ onClick }: ShareButtonProps) {
  return (
    <Button aria-label="Chia sẻ sân" className="court-icon-button" size="sm" variant="icon" onClick={onClick}>
      <Share2 aria-hidden="true" size={18} />
    </Button>
  );
}
