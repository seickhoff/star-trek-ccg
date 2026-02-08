import { useState } from "react";
import type { Skill } from "@stccg/shared";
import { ALL_SKILLS } from "@stccg/shared";
import "./SkillPicker.css";

interface SkillPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (skill: Skill) => void;
  title?: string;
}

/**
 * Modal for selecting a skill (used by order abilities like Borg Queen)
 */
export function SkillPicker({
  isOpen,
  onClose,
  onSelect,
  title = "Choose a Skill",
}: SkillPickerProps) {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedSkill) {
      onSelect(selectedSkill);
      setSelectedSkill(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedSkill(null);
    onClose();
  };

  return (
    <div className="skill-picker__overlay" onClick={handleCancel}>
      <div className="skill-picker" onClick={(e) => e.stopPropagation()}>
        <div className="skill-picker__header">
          <h3 className="skill-picker__title">{title}</h3>
        </div>

        <div className="skill-picker__content">
          <div className="skill-picker__grid">
            {ALL_SKILLS.map((skill) => (
              <button
                key={skill}
                className={`skill-picker__skill ${selectedSkill === skill ? "skill-picker__skill--selected" : ""}`}
                onClick={() => setSelectedSkill(skill)}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>

        <div className="skill-picker__footer">
          <button
            className="skill-picker__btn skill-picker__btn--cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="skill-picker__btn skill-picker__btn--confirm"
            onClick={handleConfirm}
            disabled={!selectedSkill}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
