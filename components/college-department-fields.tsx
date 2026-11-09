"use client";

import { COLLEGES, collegeLabel, departmentsFor } from "@/lib/campus";

/**
 * College first, then only that college's departments.
 * Until a college is chosen the department control stays disabled.
 */
export function CollegeDepartmentFields({
  faculty,
  department,
  onFacultyChange,
  onDepartmentChange,
  required = false,
  layout = "stack",
  idPrefix = "college",
}: {
  faculty: string;
  department: string;
  onFacultyChange: (faculty: string) => void;
  onDepartmentChange: (department: string) => void;
  required?: boolean;
  layout?: "stack" | "inline";
  idPrefix?: string;
}) {
  const options = faculty ? departmentsFor(faculty) : [];
  const departmentValue = options.some((name) => name === department) ? department : "";
  const facultyId = `${idPrefix}-name`;
  const departmentId = `${idPrefix}-department`;
  const facultyClass = layout === "inline" && faculty ? "set" : undefined;
  const departmentClass = faculty
    ? layout === "inline" && departmentValue
      ? "set"
      : undefined
    : "wait";

  const facultySelect = (
    <select
      id={facultyId}
      name="faculty"
      aria-label="College"
      value={faculty}
      required={required}
      className={facultyClass}
      onChange={(event) => {
        onFacultyChange(event.target.value);
        onDepartmentChange("");
      }}
    >
      <option value="">{required ? "Choose your college" : "All colleges"}</option>
      {COLLEGES.map((college) => {
        const label = collegeLabel(college);
        return (
          <option key={college.acronym} value={label}>
            {label}
          </option>
        );
      })}
    </select>
  );

  const departmentSelect = (
    <select
      id={departmentId}
      name="department"
      aria-label="Department"
      value={departmentValue}
      required={required}
      disabled={!faculty}
      className={departmentClass}
      onChange={(event) => onDepartmentChange(event.target.value)}
    >
      {faculty ? (
        <>
          <option value="">{required ? "Choose your department" : "All departments"}</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </>
      ) : (
        <option value="">Pick your college first</option>
      )}
    </select>
  );

  if (layout === "inline") {
    return (
      <>
        {facultySelect}
        {departmentSelect}
      </>
    );
  }

  return (
    <>
      <div className="field">
        <label htmlFor={facultyId}>College</label>
        {facultySelect}
      </div>
      <div className="field">
        <label htmlFor={departmentId}>Department</label>
        {departmentSelect}
      </div>
    </>
  );
}
