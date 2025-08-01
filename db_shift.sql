
CREATE TABLE public.employee_preferences (
  id integer NOT NULL DEFAULT nextval('employee_preferences_id_seq'::regclass),
  employee_id integer NOT NULL,
  max_continuous_days boolean DEFAULT false,
  continuous_c boolean DEFAULT false,
  double_off_after_c boolean DEFAULT false,
  CONSTRAINT employee_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT employee_preferences_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.employee_schedules (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  work_date date NOT NULL,
  employee_id integer NOT NULL,
  shift_type character NOT NULL CHECK (shift_type = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar, 'O'::bpchar])),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT employee_schedules_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.employees (
  id integer NOT NULL DEFAULT nextval('employees_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedule_cycle_members (
  cycle_id integer NOT NULL,
  employee_id integer NOT NULL,
  snapshot_name text NOT NULL,
  shift_type character varying CHECK (shift_type::bpchar = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar])),
  required_days integer,
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT schedule_cycle_members_pkey PRIMARY KEY (uuid),
  CONSTRAINT schedule_cycle_members_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.schedule_cycles(cycle_id),
  CONSTRAINT schedule_cycle_members_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.schedule_cycle_temp_offdays (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id integer NOT NULL,
  employee_id integer NOT NULL,
  offdate date NOT NULL,
  offtype character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT schedule_cycle_temp_offdays_pkey PRIMARY KEY (uuid),
  CONSTRAINT schedule_cycle_temp_offdays_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.schedule_cycles(cycle_id),
  CONSTRAINT schedule_cycle_temp_offdays_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.schedule_cycles (
  cycle_id integer NOT NULL DEFAULT nextval('schedule_cycles_cycle_id_seq'::regclass),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'draft'::text,
  created_at timestamp with time zone DEFAULT now(),
  cycle_comment text,
  CONSTRAINT schedule_cycles_pkey PRIMARY KEY (cycle_id)
);
CREATE TABLE public.shift_requirements_legacy (
  id integer NOT NULL DEFAULT nextval('shift_requirements_id_seq'::regclass),
  employee_id integer NOT NULL,
  shift_type character NOT NULL CHECK (shift_type = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar])),
  required_days integer NOT NULL,
  CONSTRAINT shift_requirements_legacy_pkey PRIMARY KEY (id),
  CONSTRAINT shift_requirements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);