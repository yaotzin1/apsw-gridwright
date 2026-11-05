import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { serializeDom } from '../helpers/serialize-dom';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

/**
 * The rendered markup is the contract the stylesheet and the MUI package rely on. These snapshots
 * were taken before the framework-neutral view layer (specs/adapter-architecture) and must not move
 * while the React shell is rebuilt on top of it: a diff here is a consumer-visible change.
 */
describe('rendered markup of the React grid', () => {
    it('a default grid on its first page', () => {
        const { container } = render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />,
        );
        expect(serializeDom(container)).toMatchSnapshot();
    });

    it('sorted descending by a header activation', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />,
        );
        await user.click(screen.getByRole('button', { name: /Salary/ }));
        await user.click(screen.getByRole('button', { name: /Salary/ }));
        expect(serializeDom(container)).toMatchSnapshot();
    });

    it('with multiple selection and a selected row', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                aria-label="People"
            />,
        );
        await user.click(screen.getAllByRole('checkbox', { name: /Select row/ })[1]!);
        expect(serializeDom(container)).toMatchSnapshot();
    });

    it('on the second page', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />,
        );
        await user.click(screen.getByRole('button', { name: /next/i }));
        expect(serializeDom(container)).toMatchSnapshot();
    });

    it('with no rows', () => {
        const { container } = render(
            <Gridwright<Person> columns={personColumns} data={[]} pageSize={3} aria-label="People" />,
        );
        expect(serializeDom(container)).toMatchSnapshot();
    });
});
