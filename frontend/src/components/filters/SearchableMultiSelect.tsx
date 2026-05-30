import { useMemo, useState } from "react";

type Option<T extends string> = {
  value: T;
  label: string;
};

type SearchableMultiSelectProps<T extends string> = {
  label: string;
  options: Array<Option<T>>;
  values: T[];
  placeholder?: string;
  single?: boolean;
  onChange: (values: T[]) => void;
};

export function SearchableMultiSelect<T extends string>({
  label,
  options,
  placeholder = "Tìm nhanh...",
  single = false,
  values,
  onChange
}: SearchableMultiSelectProps<T>) {
  const [keyword, setKeyword] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return normalizedKeyword
      ? options.filter((option) => option.label.toLowerCase().includes(normalizedKeyword))
      : options;
  }, [keyword, options]);

  const toggleValue = (value: T) => {
    if (single) {
      onChange(values.includes(value) ? [] : [value]);
      return;
    }

    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div className="filter-select2">
      <h3>{label}</h3>
      <input
        className="filter-select2__search"
        placeholder={placeholder}
        type="search"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <div className="filter-select2__options">
        {filteredOptions.map((option) => (
          <label key={option.value} className="filter-select2__option">
            <input
              checked={values.includes(option.value)}
              type={single ? "radio" : "checkbox"}
              onChange={() => toggleValue(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
