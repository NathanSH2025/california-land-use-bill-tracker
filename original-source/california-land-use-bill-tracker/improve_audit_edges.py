import json
from pathlib import Path
p=Path('/workspace/scratch/325bf04ab85f/site-checkout/public/audited-summaries.json');d=json.loads(p.read_text());s=d['summaries']
s.update({
'AB 1021':'Revises when housing is an allowed use on land owned by a local educational agency and applies Housing Accountability Act protections to qualifying projects.',
'AB 2139':'Adds qualifying City of Ontario land to the exempt surplus land category, with recorded covenants governing its disposal.',
'AB 2182':'Changes state financing rules for custom energy efficiency projects in agricultural and industrial facilities. The digest identifies no direct County land use approval duty.',
'AB 2517':'Requires the State Fire Marshal to publish proposed local fire hazard severity zone designations and notify local governments at least 180 days before finalizing them.',
'AB 2569':'Requires CEQA environmental impact reports to discuss significant effects of placing projects near, or attracting people to, existing or foreseeable natural hazards and adverse environmental conditions.',
'AB 2676':'Expands the Housing Crisis Act restriction on local policies or standards that operate as a housing development moratorium.',
'AB 36':'Moves HCD prohousing designations to permanent regulations and provides consultation to qualifying small rural jurisdictions for the seventh housing element cycle.',
'AB 385':'Allows San Bernardino County to dispose of up to 4.2 acres at Glen Helen Regional Park if it acquires replacement park property of equal or greater recreational value.',
'AB 557':'Allows approved factory built housing plans to be reused by unit serial number on later projects unless applicable building standards change.',
'AB 592':'Changes retail food and catering authorization rules, including ending new COVID-19 temporary catering authorizations in 2027. The digest identifies no direct LUS planning duty.',
'AB 76':'Changes an exempt surplus land provision for a defined sectional planning area and sets a minimum share of housing units outside academic institution housing.',
'AB 806':'Invalidates certain rental agreement or governing document restrictions on mobilehome residents and homeowners under the bill’s housing rules.',
'AB 839':'Allows the Governor to certify up to three sustainable aviation fuel projects for expedited CEQA judicial review as infrastructure projects.',
'AB 982':'Allows certain idle construction aggregate mines to request a temporary Idle Reserve Mine Status through 2032, with state review and reclamation requirements.',
'SB 1014':'Lets housing applicants request an early estimate of required public improvements when submitting a preliminary or full project application.',
'SB 1216':'Amends a 2026 state budget appropriation. The digest identifies no direct LUS planning requirement.',
'SB 1272':'Requires more time to correct nonemergency building, plumbing, electrical, or zoning violations before local enforcement under qualifying circumstances.',
'SB 1317':'Adds qualifying local surplus land within a property and business improvement district to the exempt surplus land definition.',
'SB 1383':'Revises density bonus concessions for buildings over 85 feet, including how development standard reductions and zoning changes are treated.',
'SB 1439':'Defines terms used in local government advisory body and program rules and makes other omnibus changes. Review the full text for any County operational effect.',
'SB 507':'Lets a local government make a voluntary agreement with a tribe in the same county to count new tribal housing toward the jurisdiction’s regional housing need allocation.',
'SB 606':'Changes Homeless Housing, Assistance, and Prevention planning and applications by introducing a functional zero goal for homelessness programs.',
'SB 611':'Restores a CEQA review process for qualifying community plan updates adopted since 2025 and development applications completed by the local jurisdiction by January 2036.',
'SB 625':'Makes private covenants or governing documents void to the extent they prohibit or unreasonably restrict qualifying housing development under the bill’s rule.',
'SB 71':'Extends transit project CEQA exemptions and adds certain transit route analyses and changes, with exceptions for ferry terminals and transportation network company services.',
})
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
