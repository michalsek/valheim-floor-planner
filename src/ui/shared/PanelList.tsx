import type { ReactNode } from 'react';

import styles from './PanelList.module.css';

/** A titled list in a side panel. */
export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={styles.section}>
    <h2 className={styles.heading}>{title}</h2>
    <ul className={styles.list}>{children}</ul>
  </section>
);

/** A "label … value" line in a `Section`. */
export const Row = ({ label, value }: { label: ReactNode; value: ReactNode }) => (
  <li className={styles.row}>
    <span>{label}</span>
    <span className={styles.value}>{value}</span>
  </li>
);
