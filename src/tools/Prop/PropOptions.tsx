import { useAtomValue, useSetAtom } from 'jotai';

import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { Stepper } from '../../controls/Stepper';
import { formatCompact } from '../../format';
import { flightCount, type Flight } from '../../model/flight';
import { MAX_ELEVATION } from '../../model/elevation';
import { elevationStepAtom } from '../../store/session';

import { useFlightRise } from './propFlight';
import { armedDefAtom, flightRiseAtom, propRotationAtom } from './propState';

/** The rise a stair or ladder flight climbs ("Auto": to the next level up). */
const FlightOptions = ({ flight }: { flight: Flight }) => {
  const rise = useFlightRise();
  const set = useAtomValue(flightRiseAtom);
  const setRise = useSetAtom(flightRiseAtom);
  const step = useAtomValue(elevationStepAtom);
  const n = flightCount(flight, rise);
  return (
    <>
      <Field label="Rise">
        <Stepper
          label="Rise"
          value={rise}
          min={step}
          max={MAX_ELEVATION}
          step={step}
          format={(v) => `${formatCompact(v)} m`}
          onChange={setRise}
        />
        {set !== null && (
          <Button title="Climb to the next level up" onClick={() => setRise(null)}>
            Auto
          </Button>
        )}
      </Field>
      <span>
        {n}× · {formatCompact(n * flight.run)} m run for {formatCompact(n * flight.rise)} m
      </span>
    </>
  );
};

/** What the Prop tool places and how it's turned, with the keys that change it. */
export const PropOptions = () => {
  const def = useAtomValue(armedDefAtom);
  const rotation = useAtomValue(propRotationAtom);
  if (!def) return <span>Pick an item in the catalogue</span>;
  return (
    <>
      <span>{def.name}</span>
      <span>{formatCompact(rotation)}°</span>
      {def.flight && <FlightOptions flight={def.flight} />}
      <span>R 90° · Shift+R 22.5° · Esc to stop</span>
    </>
  );
};
