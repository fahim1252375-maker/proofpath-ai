import React from 'react';
import { ArrowUpRight, Radar, SlidersHorizontal } from 'lucide-react';

export interface OpportunityRadarCardProps {
  matchedCount: number;
  educationLevel: string;
  gpa: number | null;
  gpaScale: number;
  financialNeed: string;
  targetCountries: string[];
  academicInterests: string[];
  profileIncomplete: boolean;
  onTune: () => void;
  onExplore: () => void;
}

function readable(value: string): string {
  return value.replace(/_/g, ' ').trim() || 'Not set';
}

function compactList(values: string[], emptyLabel: string): string {
  if (values.length === 0) return emptyLabel;
  const visible = values.slice(0, 2).join(' · ');
  return values.length > 2 ? `${visible} +${values.length - 2}` : visible;
}

export function OpportunityRadarCard({
  matchedCount,
  educationLevel,
  gpa,
  gpaScale,
  financialNeed,
  targetCountries,
  academicInterests,
  profileIncomplete,
  onTune,
  onExplore,
}: OpportunityRadarCardProps) {
  const countryLabel = compactList(targetCountries, 'Global / open');
  const interestLabel = compactList(academicInterests, 'Add academic interests');
  const academicLabel = gpa === null
    ? `${readable(educationLevel)} · GPA needed`
    : `${readable(educationLevel)} · ${gpa}/${gpaScale}`;

  return (
    <section className="pp-radar-card" aria-labelledby="personal-radar-title">
      <div className="pp-radar-top">
        <div>
          <p className="pp-radar-eyebrow">
            <Radar className="h-3.5 w-3.5" aria-hidden="true" />
            Personal opportunity radar
          </p>
          <h2 id="personal-radar-title" className="pp-radar-heading">Your opportunity field</h2>
        </div>
        <span className={`pp-radar-status ${profileIncomplete ? 'is-incomplete' : 'is-ready'}`}>
          <span className="pp-radar-status-dot" aria-hidden="true" />
          {profileIncomplete ? 'Needs setup' : 'Core profile ready'}
        </span>
      </div>

      <div className="pp-radar-visual-row">
        <div
          className="pp-radar-scene"
          role="img"
          aria-label={`${matchedCount} opportunity radar matches based on your current profile`}
        >
          <div className="pp-radar-orbit-system" aria-hidden="true">
            <span className="pp-radar-ring pp-radar-ring-outer" />
            <span className="pp-radar-ring pp-radar-ring-middle" />
            <span className="pp-radar-ring pp-radar-ring-inner" />
            <span className="pp-radar-sweep" />
            <span className="pp-radar-node pp-radar-node-one" />
            <span className="pp-radar-node pp-radar-node-two" />
            <span className="pp-radar-node pp-radar-node-three" />
            <span className="pp-radar-axis" />
          </div>
          <div className="pp-radar-core">
            <span className="pp-radar-count">{matchedCount}</span>
            <span className="pp-radar-count-label">{matchedCount === 1 ? 'match' : 'matches'}</span>
          </div>
          <span className="pp-radar-float-tag pp-radar-tag-top">PROFILE</span>
          <span className="pp-radar-float-tag pp-radar-tag-right">ELIGIBILITY</span>
          <span className="pp-radar-float-tag pp-radar-tag-bottom">DEADLINES</span>
        </div>

        <div className="pp-radar-detail">
          <p className="pp-radar-summary">
            {profileIncomplete
              ? 'A few profile details are missing. Add them to make your opportunity matching more useful.'
              : 'Your matching view is using the profile signals below. Update them any time your goals change.'}
          </p>
          <div className="pp-radar-signals">
            <div className="pp-radar-signal">
              <span>Academic profile</span>
              <strong title={academicLabel}>{academicLabel}</strong>
            </div>
            <div className="pp-radar-signal">
              <span>Target countries</span>
              <strong title={targetCountries.join(', ') || 'Global / open'}>{countryLabel}</strong>
            </div>
            <div className="pp-radar-signal">
              <span>Academic focus</span>
              <strong title={academicInterests.join(', ') || 'Not set'}>{interestLabel}</strong>
            </div>
            <div className="pp-radar-signal">
              <span>Funding preference</span>
              <strong>{readable(financialNeed)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="pp-radar-footer">
        <p>Matches are indicative. Review each program's official criteria before applying.</p>
        <div className="pp-radar-actions">
          <button type="button" className="pp-radar-button pp-radar-button-secondary" onClick={onTune}>
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Tune profile
          </button>
          <button type="button" className="pp-radar-button pp-radar-button-primary" onClick={onExplore}>
            Explore matches
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
