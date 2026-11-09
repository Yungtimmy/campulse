"use client";

import { useState } from "react";
import { departmentsFor } from "@/lib/campus";
import { CollegeDepartmentFields } from "@/components/college-department-fields";

export function CollegeDepartmentFilters({
  faculty = "",
  department = "",
}: {
  faculty?: string;
  department?: string;
}) {
  const [college, setCollege] = useState(faculty);
  const [dept, setDept] = useState(
    departmentsFor(faculty).some((name) => name === department) ? department : "",
  );

  return (
    <CollegeDepartmentFields
      layout="inline"
      idPrefix="filter-college"
      faculty={college}
      department={dept}
      onFacultyChange={(next) => {
        setCollege(next);
        setDept("");
      }}
      onDepartmentChange={setDept}
    />
  );
}
