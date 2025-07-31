import React from "react";
import StandardPage from "./StandardPage";

function MainReportContent({ data }) {
    return (
        <StandardPage
            header="System Performance"
            // footer="Orka Solar - Design Report"
            data={data} // Pass the data prop to StandardPage
            pageNumber={3} // Set an appropriate page number here
            totalPages={24} // Set the total number of pages in your report
        >
            <h4>Site Information</h4>
            <div>
                This site is located at {data?.project?.location}, South Africa: {data?.project?.latitude}, {data?.project?.longitude}.
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        {/* <td>PV Capacity</td>
                        <td>{data?.project?.pv_kwp || "32.2 kWp"}</td>
                    </tr>
                    <tr>
                        <td>Inverter Capacity</td>
                        <td>{data?.project?.inverter_total || "50 kVA"}</td>
                    </tr>
                    <tr>
                        <td>Battery Storage</td>
                        <td>{data?.project?.battery_kwh_100 || "0 kWh"}</td>
                    </tr>
                    <tr>
                        <td>CAPEX</td>
                        <td>{data?.project?.capex || "R465,527"}</td>
                    </tr>
                    <tr>
                        <td>Savings Year 1</td>
                        <td>{data?.project?.savings_year1 || "R107,676"}</td> */}
                    </tr>
                </tbody>
            </table>
        </StandardPage>
    );
}

export default MainReportContent;